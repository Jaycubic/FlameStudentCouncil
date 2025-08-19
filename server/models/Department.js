const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Department extends Model {
  static associate(models) {
    Department.belongsTo(models.Location, { foreignKey: 'locationName', targetKey: 'locationName' });
  }
}

Department.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  departmentName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  locationName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  hodName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  hodEmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'Department',
  tableName: 'departments',
});

module.exports = Department;
