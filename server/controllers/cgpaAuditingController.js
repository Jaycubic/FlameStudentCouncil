// server/controllers/cgpaAuditingController.js
// Controller for CGPA auditing: uniques, filter intelligence, trigger audit

const { Op, fn, col } = require('sequelize');
const sequelize = require('../config/cgpa');
const DegreeProgressAudit = require('../models/DegreeProgressAudit');
const BatchAcademicYears = require('../models/BatchAcademicYears');
const CgpaShortfall = require('../models/CgpaShortfall');
const { getAuditManager } = require('../utils/AuditManager');

const cgpaAuditingController = {
  async getUniqueBatches(req, res) {
    try {
      const search = req.query.search || '';
      const where = { class_year: { [Op.not]: null } };
      if (search) where.class_year[Op.iLike] = `%${search}%`;

      const values = await DegreeProgressAudit.findAll({
        attributes: [[fn('DISTINCT', col('class_year')), 'class_year']],
        where,
        order: [[col('class_year'), 'ASC']],
        raw: true,
      });

      const uniqueBatches = values.map(v => v.class_year).filter(val => val && val !== '');
      res.json(uniqueBatches);
    } catch (error) {
      console.error('Error fetching unique batches:', error);
      res.status(500).json({ message: 'Error fetching unique batches', error: error.message });
    }
  },

  async getValidAcademicYears(req, res) {
    try {
      const { batch } = req.query;
      if (!batch) return res.status(400).json({ message: 'Batch required' });

      const batchInfo = await BatchAcademicYears.findOne({ where: { batch } });
      if (!batchInfo) return res.status(404).json({ message: 'Batch not found' });

      // Inclusive: if user selects a year, include all prior
      // But for dropdown, return all valid
      res.json(batchInfo.valid_academic_years);
    } catch (error) {
      console.error('Error fetching valid academic years:', error);
      res.status(500).json({ message: 'Error fetching valid academic years', error: error.message });
    }
  },

  async getValidPeriods(req, res) {  // Semesters/Terms based on year
    try {
      const { batch, academicYear } = req.query;
      if (!batch || !academicYear) return res.status(400).json({ message: 'Batch and academicYear required' });

      const batchInfo = await BatchAcademicYears.findOne({ where: { batch } });
      if (!batchInfo) return res.status(404).json({ message: 'Batch not found' });

      const validYears = batchInfo.valid_academic_years;
      const yearIndex = validYears.indexOf(academicYear);
      if (yearIndex === -1) return res.status(400).json({ message: 'Invalid academic year for batch' });

      let periods = [];
      if (yearIndex === 0) {  // Year 1: Terms
        periods = ['Term-1', 'Term-2', 'Term-3', 'Term-4'];
      } else {  // Year 2+: Semesters (adjust naming: Sem 3, Sem 4 for year 2, etc.)
        const semNum = (yearIndex * 2) + 1;  // Year 2: Sem 3-4, etc.
        periods = [`Sem ${semNum}`, `Sem ${semNum + 1}`];
      }

      res.json(periods);
    } catch (error) {
      console.error('Error fetching valid periods:', error);
      res.status(500).json({ message: 'Error fetching valid periods', error: error.message });
    }
  },

  getMyTermRange(yearIndex, period) {
    // Helper to compute my_term min/max for the period
    let minTerm, maxTerm;
    if (yearIndex === 0 && period.startsWith('Term-')) {
      const termNum = parseInt(period.split('-')[1]);
      minTerm = maxTerm = termNum;
    } else if (period.startsWith('Sem ')) {
      const semNum = parseInt(period.split(' ')[1]);
      minTerm = (semNum - 1) * 2 + 1;
      maxTerm = minTerm + 1;
    } else {
      throw new Error('Invalid period format');
    }
    return { minTerm, maxTerm };
  },

  async triggerCgpaAudit(req, res) {
    // console.log('[CGPA Audit] Triggered (Auto-Detect Mode).', req.body);
    const { batch } = req.body;
    if (!batch) {
      return res.status(400).json({ message: 'Batch is required for audit' });
    }

    const auditManager = getAuditManager();
    let isLocked = false;

    try {
      if (!auditManager.acquireLock('CGPA', batch)) {
        return res.status(409).json({ message: 'An audit for this batch is already in progress.' });
      }
      isLocked = true;

      // Safe Truncate
      await sequelize.query('TRUNCATE TABLE "app"."cgpashortfall" RESTART IDENTITY CASCADE;');
      console.log(`[CGPA Audit] Truncated tables for fresh run.`);

      // Step 1: Fetch ALL relevant records for the batch
      const audits = await DegreeProgressAudit.findAll({
        where: {
          class_year: batch,
          enrollment_status: { [Op.notIn]: ['Withdrawn', 'Inactive'] },
        },
        attributes: [
          'student_id',
          'student_name',
          'cumulative_gpa',
          'my_term',
          'course_offering_id',
          'term_name' // Critical for extracting Academic Year
        ],
        raw: true,
      });

      if (audits.length === 0) {
        console.log(`[CGPA Audit] No records found for batch ${batch}.`);
        return res.json({ message: 'CGPA audit completed', flaggedCount: 0, flaggedStudents: [] });
      }

      // Regex to parse period from course_offering_id
      const periodRegex = /(TERM|SEM)(\d+)/i;

      // Helper to parse a record's period
      const getRecordPeriod = (r) => {
        if (!r.course_offering_id) return null;
        if (r.course_offering_id.startsWith('PUTERM') || r.course_offering_id.startsWith('PUSEM')) return null;

        const match = r.course_offering_id.match(periodRegex);
        if (match) {
          const pType = match[1].toUpperCase().startsWith('SEM') ? 'Sem' : 'Term';
          const pNum = parseInt(match[2]);
          return `${pType}-${pNum}`;
        }
        return null;
      };

      // Step 2: Group by student & Find Current Status
      const studentMap = {};
      for (const record of audits) {
        if (!studentMap[record.student_id]) {
          studentMap[record.student_id] = {
            student_name: record.student_name,
            records: [],
            maxMyTerm: 0,
            latestRecord: null // To hold the record corresponding to maxMyTerm
          };
        }

        const termVal = parseInt(record.my_term ? record.my_term.toString().replace(/\D/g, '') : '0');

        studentMap[record.student_id].records.push(record);

        if (!isNaN(termVal)) {
          if (termVal > studentMap[record.student_id].maxMyTerm) {
            studentMap[record.student_id].maxMyTerm = termVal;
            studentMap[record.student_id].latestRecord = record; // Tentative latest
          }
        }
      }

      let flaggedCount = 0;
      const results = [];
      const studentEntries = Object.entries(studentMap);
      const totalStudents = studentEntries.length;

      // Step 3: Process each student
      for (let i = 0; i < totalStudents; i++) {
        const [studentId, data] = studentEntries[i];
        
        // Update progress every 10 students or at the end
        if (i % 10 === 0 || i === totalStudents - 1) {
          auditManager.updateProgress('CGPA', batch, (i / totalStudents) * 100);
        }

        const { maxMyTerm, records, student_name, latestRecord } = data;

        if (maxMyTerm === 0) continue;

        // Auto-Detect Academic Year from latest record's term_name (e.g., '2024/25S1')
        let detectedYear = 'N/A';
        if (latestRecord && latestRecord.term_name) {
          const yearMatch = latestRecord.term_name.match(/^(\d{4}\/\d{2})/);
          if (yearMatch) {
            detectedYear = yearMatch[1].replace('/', '-');
          } else {
            detectedYear = latestRecord.term_name;
          }
        }

        let chain = [];
        switch (maxMyTerm) {
          case 1: chain = ['Term-2', 'Term-1']; break;
          case 2: chain = ['Term-4', 'Term-3']; break;
          case 3: chain = ['Internship-1', 'Term-4']; break;
          case 4: chain = ['Sem-3', 'Internship-1', 'Term-4']; break;
          case 5: chain = ['Sem-4', 'Sem-3']; break;
          case 6: chain = ['Internship-2', 'Sem-4']; break;
          case 7: chain = ['Sem-5', 'Internship-2']; break;
          case 8: chain = ['Sem-6', 'Sem-5']; break;
          case 9: chain = ['Sem-7', 'Sem-6']; break;
          case 10: chain = ['Sem-8', 'Sem-7']; break;
          default:
            chain = [`Sem-${maxMyTerm}`, `Sem-${maxMyTerm - 1}`];
            break;
        }

        let foundGpa = null;
        let foundPeriod = null;

        for (const targetPeriod of chain) {
          let relevantRecord = null;
          if (targetPeriod.startsWith('Internship')) {
            const targetMyTerm = targetPeriod === 'Internship-1' ? '3' : '6';
            relevantRecord = records.find(r => r.my_term === targetMyTerm && r.cumulative_gpa != null);
          } else {
            relevantRecord = records.find(r => {
              const parsed = getRecordPeriod(r);
              return parsed === targetPeriod && r.cumulative_gpa != null;
            });
          }

          if (relevantRecord) {
            foundGpa = parseFloat(relevantRecord.cumulative_gpa);
            foundPeriod = targetPeriod;
            break;
          }
        }

        if (foundGpa === null) {
          const sortedByTerm = records
            .filter(r => r.cumulative_gpa != null)
            .sort((a, b) => parseInt(b.my_term) - parseInt(a.my_term));

          if (sortedByTerm.length > 0) {
            foundGpa = parseFloat(sortedByTerm[0].cumulative_gpa);
            foundPeriod = getRecordPeriod(sortedByTerm[0]) || `Term-${sortedByTerm[0].my_term}`;
          }
        }

        if (foundGpa !== null && !isNaN(foundGpa)) {
          if (foundGpa < 5.00) {
            await CgpaShortfall.upsert({
              student_id: studentId,
              student_name: student_name,
              batch,
              academic_year: detectedYear,
              period: foundPeriod || 'Unknown',
              cumulative_gpa: foundGpa,
            });
            flaggedCount++;
            results.push({ student_id: studentId, student_name, gpa: foundGpa, period: foundPeriod });
          }
        }
      }

      console.log(`[CGPA Audit] Finished. Flagged: ${flaggedCount}`);
      auditManager.updateProgress('CGPA', batch, 100);
      res.json({ message: 'CGPA audit completed', flaggedCount, flaggedStudents: results });
    } catch (error) {
      console.error('[CGPA Audit] CRITICAL ERROR:', error);
      res.status(500).json({ message: 'Error triggering audit', error: error.message });
    } finally {
      if (isLocked) {
        auditManager.releaseLock('CGPA', batch);
      }
    }
  },

  async getAuditData(req, res) {
    try {
      const { batch, academicYear, period, page = 1, limit = 100, search = '' } = req.query;

      const where = {};
      if (batch) where.batch = batch;
      // Logic Update: Do NOT filter by academicYear or period for fetching.
      // Since the audit auto-detects these values, they may not match the dropdowns.
      // We want to show ALL shortfalls found for this batch.
      // if (academicYear) where.academic_year = academicYear; 
      // if (period) where.period = period;

      if (search) {
        where.student_name = { [Op.iLike]: `%${search}%` };
      }

      const totalCount = await CgpaShortfall.count({
        where,
        distinct: true,
        col: 'student_id'
      });
      const offset = (parseInt(page) - 1) * parseInt(limit);

      const rows = await CgpaShortfall.findAll({
        where,
        order: [['student_id', 'ASC']],
        limit: parseInt(limit),
        offset,
        raw: true
      });

      res.json({
        data: rows,
        stats: { totalShortfalls: totalCount },
        total: totalCount,
        page: parseInt(page),
        pages: Math.ceil(totalCount / parseInt(limit))
      });
    } catch (error) {
      console.error('Error fetching CGPA audit data:', error);
      res.status(500).json({ message: 'Error fetching audit data', error: error.message });
    }
  },
};

module.exports = cgpaAuditingController;