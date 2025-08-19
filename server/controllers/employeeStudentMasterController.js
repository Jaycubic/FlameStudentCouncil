const EmployeeStudentMaster = require("../models/EmployeeStudentMaster");
const { Op } = require("sequelize");

/**
 * Get a single employee record based on EmployeeCode.
 * Expects a query parameter 'code'.
 * Returns EmployeeName, Batch, Gender, DOB, Email, EmployeePhoto, FatherMobileNo, MotherMobileNo, BLOODGROUP.
 */
const getEmployeeByCode = async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ message: "Code parameter is required" });
      }

      const employee = await EmployeeStudentMaster.findOne({
        where: { EmployeeCode: code },
        attributes: [
          'EmployeeName',
          'Batch',
          'Gender',
          'DOB',
          'Email',
          'EmployeePhoto',
          'FatherMobileNo',
          'MotherMobileNo',
          'BLOODGROUP'
        ]
      });

      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      // Log the employee data to check if BLOODGROUP is included
      console.log('Employee Data for code', code, ':', employee.toJSON());

      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

/**
 * Get a paginated list of employee records.
 * Accepts optional query parameters:
 * - page: The page number (default is 1)
 * - limit: The number of records per page (default is 50)
 * Returns EmployeeCode, EmployeeName, Batch, Gender, DOB, Email, EmployeePhoto, FatherMobileNo, MotherMobileNo, BLOODGROUP.
 */
const getEmployees = async (req, res) => {
    try {
      let { page, limit } = req.query;
      page = parseInt(page) || 1;
      limit = parseInt(limit) || 50;
      const offset = (page - 1) * limit;

      const { count, rows } = await EmployeeStudentMaster.findAndCountAll({
        offset,
        limit,
        attributes: [
          'EmployeeCode',
          'EmployeeName',
          'Batch',
          'Gender',
          'DOB',
          'Email',
          'EmployeePhoto',
          'FatherMobileNo',
          'MotherMobileNo',
          'BLOODGROUP'
        ]
      });

      // Log the employees data to check if BLOODGROUP is included (first 5 records)
      console.log('Employees Data (first 5 records):', rows.slice(0, 5).map(emp => emp.toJSON()));

      res.json({
        totalRecords: count,
        currentPage: page,
        pageSize: limit,
        data: rows
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

module.exports = {
  getEmployeeByCode,
  getEmployees
};
