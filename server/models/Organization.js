const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Organization extends Model {
  static associate(models) {
    Organization.hasMany(models.Location, { foreignKey: 'OrganizationName', sourceKey: 'name' });
  }
}

Organization.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  websiteLink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contactPersonName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contactPersonMobile: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  personEmail: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gstNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'Organization',
  tableName: 'organizations',
});

module.exports = Organization;
