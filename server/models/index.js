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
const Positions = require('./Positions');
const LegalDocument = require('./LegalDocument');
const academicAttachment = require('./academicAttachment');
const SportAttachment = require('./SportAttachment');
const CulturalAttachment = require('./CulturalAttachment');
const TimeSettings = require('./TimeSettings');
const footer = require('./footer');
const formSubmissions = require('./formSubmissions');
const EmployeeStudentMaster = require('./EmployeeStudentMaster');
const WellbeingDeclaration = require('./WellbeingDeclaration');

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
  Positions,
  LegalDocument,
  academicAttachment,
  SportAttachment,
  CulturalAttachment,
  TimeSettings,
  footer,
  formSubmissions,
  EmployeeStudentMaster,
  WellbeingDeclaration
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

// Form Submission Associations
formSubmissions.hasMany(academicAttachment, { foreignKey: 'submission_id' });
academicAttachment.belongsTo(formSubmissions, { foreignKey: 'submission_id' });

formSubmissions.hasMany(SportAttachment, { foreignKey: 'submission_id' });
SportAttachment.belongsTo(formSubmissions, { foreignKey: 'submission_id' });

formSubmissions.hasMany(CulturalAttachment, { foreignKey: 'submission_id' });
CulturalAttachment.belongsTo(formSubmissions, { foreignKey: 'submission_id' });

module.exports = models;
