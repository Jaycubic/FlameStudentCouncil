const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

class Department extends Model {
  static associate(models) {
    Department.belongsTo(models.Location, { foreignKey: 'location_name', targetKey: 'location_name' });
  }
}

Department.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  department_name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  location_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  hod_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  hod_email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  sequelize,
  tableName: 'departments',
});

module.exports = Department;
