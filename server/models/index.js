// models/index.js
const sequelize = require('../config/connection');
const Organization = require('./Organization');
const Location = require('./Location');
const Department = require('./Department');
const User = require('./User');
const Role = require('./Role');
const Setting = require('./Setting');
const ActivityTracker = require('./ActivityTracker');
const UserNotificationStatus = require('./UserNotificationStatus');
const Counter = require('./counter');
const Queue = require('./Queue');
const RoleSetting = require('./RoleSetting');
const StudentData = require('./StudentData');
const StudentLogs = require('./StudentLogs');
const LegalDocument = require('./LegalDocument');
const academicAttachment = require('./academicAttachment');
const SportAttachment = require('./SportAttachment');
const CulturalAttachment = require('./CulturalAttachment');
const TimeSettings = require('./TimeSettings');
const footer = require('./footer');
const ElectionFormResponse = require('./ElectionFormResponse');
const ElectionDraft        = require('./ElectionDraft');
const ElectionAttachment   = require('./ElectionAttachment');
const EmployeeStudentMaster = require('./EmployeeStudentMaster');
const WellbeingDeclaration = require('./WellbeingDeclaration');
const CulturalUserSheet = require('./CulturalUserSheet');
const SportsUserSheet = require('./SportsUserSheet');
const PhotoDriveUpload = require('./PhotoDriveUpload');
const AwardsWorkbook      = require('./AwardsWorkbook');
const AcademicUserSheet   = require('./AcademicUserSheet');
const NominatedStudent    = require('./NominatedStudent');
const StudentCgpaCache    = require('./StudentCgpaCache');
const SheetPool           = require('./SheetPool');
const EmailLog            = require('./EmailLog');
const Position            = require('./Position');

const models = {
  Organization,
  Location,
  Department,
  User,
  Role,
  Setting,
  ActivityTracker,
  UserNotificationStatus,
  Counter,
  Queue,
  RoleSetting,
  StudentData,
  StudentLogs,
  LegalDocument,
  academicAttachment,
  SportAttachment,
  CulturalAttachment,
  TimeSettings,
  footer,
  ElectionFormResponse,
  ElectionDraft,
  ElectionAttachment,
  EmployeeStudentMaster,
  WellbeingDeclaration,
  CulturalUserSheet,
  SportsUserSheet,
  PhotoDriveUpload,
  AwardsWorkbook,
  AcademicUserSheet,
  NominatedStudent,
  StudentCgpaCache,
  SheetPool,
  EmailLog,
  Position,
};

Object.values(models).forEach(model => {
  if (model.associate) {
    model.associate(models);
  }
});

// Set up associations
Role.hasMany(User, { foreignKey: 'role_id' });
User.belongsTo(Role, { foreignKey: 'role_id' });

User.hasMany(UserNotificationStatus, { foreignKey: 'user_id' });
ActivityTracker.hasMany(UserNotificationStatus, { foreignKey: 'activity_id' });
UserNotificationStatus.belongsTo(User, { foreignKey: 'user_id' });
UserNotificationStatus.belongsTo(ActivityTracker, { foreignKey: 'activity_id' });

Counter.belongsTo(Department, { foreignKey: 'department_name', targetKey: 'department_name' });
Department.hasMany(Counter, { foreignKey: 'department_name', sourceKey: 'department_name' });

// Queue depends on counter
Queue.belongsTo(Counter, { foreignKey: 'counter_id' });

Role.hasMany(RoleSetting, { foreignKey: 'role_id' });
RoleSetting.belongsTo(Role, { foreignKey: 'role_id' });

// ElectionFormResponse ↔ ElectionAttachment
ElectionFormResponse.hasMany(ElectionAttachment, { foreignKey: 'submission_id' });
ElectionAttachment.belongsTo(ElectionFormResponse, { foreignKey: 'submission_id' });

module.exports = models;
