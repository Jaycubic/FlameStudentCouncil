const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Location extends Model {
  static associate(models) {
    Location.belongsTo(models.Organization, { foreignKey: 'OrganizationName', targetKey: 'name' });
    Location.hasMany(models.Department, { foreignKey: 'locationName', sourceKey: 'locationName' });
  }
}

Location.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  locationName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  OrganizationName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  DeviceId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  sequelize,
  modelName: 'Location',
  tableName: 'locations',
});

module.exports = Location;
