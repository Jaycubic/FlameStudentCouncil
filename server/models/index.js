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
const TrailblazerAward = require('./TrailblazerAward');
const SportsPersonAward = require('./SportsPersonAward');
const CulturalPersonAward = require('./CulturalPersonAward');
const EmployeeStudentMaster = require('./EmployeeStudentMaster');
const WellbeingDeclaration = require('./WellbeingDeclaration');
const CulturalUserSheet = require('./CulturalUserSheet');
const SportsUserSheet = require('./SportsUserSheet');
const PhotoDriveUpload = require('./PhotoDriveUpload');

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
  TrailblazerAward,
  SportsPersonAward,
  CulturalPersonAward,
  EmployeeStudentMaster,
  WellbeingDeclaration,
  CulturalUserSheet,
  SportsUserSheet,
  PhotoDriveUpload
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

// Trailblazer Award Associations
TrailblazerAward.hasMany(academicAttachment, { foreignKey: 'submission_id' });
academicAttachment.belongsTo(TrailblazerAward, { foreignKey: 'submission_id' });

TrailblazerAward.hasMany(SportAttachment, { foreignKey: 'submission_id' });
SportAttachment.belongsTo(TrailblazerAward, { foreignKey: 'submission_id' });

TrailblazerAward.hasMany(CulturalAttachment, { foreignKey: 'submission_id' });
CulturalAttachment.belongsTo(TrailblazerAward, { foreignKey: 'submission_id' });

// Sports Person Award Associations
SportsPersonAward.hasMany(SportAttachment, { foreignKey: 'submission_id' });
SportAttachment.belongsTo(SportsPersonAward, { foreignKey: 'submission_id' });

// Cultural Person Award Associations
CulturalPersonAward.hasMany(CulturalAttachment, { foreignKey: 'submission_id' });
CulturalAttachment.belongsTo(CulturalPersonAward, { foreignKey: 'submission_id' });

module.exports = models;
