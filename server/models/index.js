const sequelize = require('../config/database');
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
const RoleSetting = require('./RoleSetting'); // Add RoleSetting model import

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
  RoleSetting // Add RoleSetting to models
};

Object.values(models).forEach(model => {
  if (model.associate) {
    model.associate(models);
  }
});

// Set up associations
Role.hasMany(User);
User.belongsTo(Role);

User.hasMany(UserNotificationStatus, { foreignKey: 'userId' });
ActivityTracker.hasMany(UserNotificationStatus, { foreignKey: 'activityId' });
UserNotificationStatus.belongsTo(User, { foreignKey: 'userId' });
UserNotificationStatus.belongsTo(ActivityTracker, { foreignKey: 'activityId' });

Counter.belongsTo(Department, { foreignKey: 'DepartmentName', targetKey: 'departmentName' });
Department.hasMany(Counter, { foreignKey: 'DepartmentName', sourceKey: 'departmentName' });

User.belongsTo(Counter, { foreignKey: 'CounterId' });

Queue.belongsTo(Counter, { foreignKey: 'CounterId' });

Role.hasMany(RoleSetting, { foreignKey: 'role_id' }); // Add Role to RoleSetting association
RoleSetting.belongsTo(Role, { foreignKey: 'role_id' });

module.exports = models;
