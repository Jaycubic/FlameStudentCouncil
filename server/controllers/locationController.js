const { Location, Organization } = require('../models');

const locationController = {
  async getAllLocations(req, res) {
    try {
      const locations = await Location.findAll({
        include: [{ model: Organization, attributes: ['name'] }],
      });
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching locations', error: error.message });
    }
  },

  async createLocation(req, res) {
    try {
      const { locationName, OrganizationName, DeviceId } = req.body;

      if (!locationName || !OrganizationName || !DeviceId) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const organization = await Organization.findOne({ where: { name: OrganizationName } });
      if (!organization) {
        return res.status(400).json({ message: 'Invalid organization name' });
      }

      const location = await Location.create({
        location_name: locationName,
        organization_name: OrganizationName,
        device_id: DeviceId,
      });

      res.status(201).json({ message: 'Location created successfully', location });
    } catch (error) {
      console.error('Error creating location:', error);
      res.status(500).json({ message: 'Error creating location', error: error.message });
    }
  },

  async getLocationById(req, res) {
    try {
      const { id } = req.params;
      const location = await Location.findByPk(id, {
        include: [{ model: Organization, attributes: ['name'] }],
      });
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }
      res.json(location);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching location', error: error.message });
    }
  },

  async updateLocation(req, res) {
    try {
      const { id } = req.params;
      const { locationName, OrganizationName, DeviceId } = req.body;
      const location = await Location.findByPk(id);
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }

      if (OrganizationName) {
        const organization = await Organization.findOne({ where: { name: OrganizationName } });
        if (!organization) {
          return res.status(400).json({ message: 'Invalid organization name' });
        }
      }

      await location.update({
        location_name: locationName || location.location_name,
        organization_name: OrganizationName || location.organization_name,
        device_id: DeviceId || location.device_id,
      });
      res.json({ message: 'Location updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error updating location', error: error.message });
    }
  },

  async deleteLocation(req, res) {
    try {
      const { id } = req.params;
      const location = await Location.findByPk(id);
      if (!location) {
        return res.status(404).json({ message: 'Location not found' });
      }
      await location.destroy();
      res.json({ message: 'Location deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting location', error: error.message });
    }
  },
};

module.exports = locationController;
