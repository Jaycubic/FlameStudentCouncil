const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

class Location extends Model {
  static associate(models) {
    Location.belongsTo(models.Organization, { foreignKey: 'organization_name', targetKey: 'name' });
    Location.hasMany(models.Department, { foreignKey: 'location_name', sourceKey: 'location_name' });
  }
}

Location.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  location_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  organization_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  device_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  sequelize,
  tableName: 'locations',
});

module.exports = Location;
