const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/connection');

class Organization extends Model {
  static associate(models) {
    Organization.hasMany(models.Location, { foreignKey: 'organization_name', sourceKey: 'name' });
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
    unique: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  phone_number: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  website_link: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  contact_person_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  contact_person_mobile: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  person_email: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gst_number: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  sequelize,
  tableName: 'organizations',
});

module.exports = Organization;
