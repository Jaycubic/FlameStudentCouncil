const { Organization } = require('../models');

const organizationController = {
  async getAllOrganizations(req, res) {
    try {
      const organizations = await Organization.findAll();
      res.json(organizations);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching organizations', error: error.message });
    }
  },

  async createOrganization(req, res) {
    try {
      const {
        name,
        address,
        phoneNumber,
        email,
        websiteLink,
        contactPersonName,
        contactPersonMobile,
        personEmail,
        gstNumber,
      } = req.body;

      if (!name || !address || !phoneNumber || !email || !contactPersonName || !contactPersonMobile) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      const organization = await Organization.create({
        name,
        address,
        phone_number: phoneNumber,
        email,
        website_link: websiteLink,
        contact_person_name: contactPersonName,
        contact_person_mobile: contactPersonMobile,
        person_email: personEmail,
        gst_number: gstNumber,
      });

      res.status(201).json({ message: 'Organization created successfully', organization });
    } catch (error) {
      console.error('Error creating organization:', error);
      res.status(500).json({ message: 'Error creating organization', error: error.message });
    }
  },

  async getOrganizationById(req, res) {
    try {
      const { id } = req.params;
      const organization = await Organization.findByPk(id);
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      res.json(organization);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching organization', error: error.message });
    }
  },

  async updateOrganization(req, res) {
    try {
      const { id } = req.params;
      const {
        name,
        address,
        phoneNumber,
        email,
        websiteLink,
        contactPersonName,
        contactPersonMobile,
        personEmail,
        gstNumber,
      } = req.body;
      const organization = await Organization.findByPk(id);
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }

      await organization.update({
        name: name || organization.name,
        address: address || organization.address,
        phone_number: phoneNumber || organization.phone_number,
        email: email || organization.email,
        website_link: websiteLink || organization.website_link,
        contact_person_name: contactPersonName || organization.contact_person_name,
        contact_person_mobile: contactPersonMobile || organization.contact_person_mobile,
        person_email: personEmail || organization.person_email,
        gst_number: gstNumber || organization.gst_number,
      });
      res.json({ message: 'Organization updated successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error updating organization', error: error.message });
    }
  },

  async deleteOrganization(req, res) {
    try {
      const { id } = req.params;
      const organization = await Organization.findByPk(id);
      if (!organization) {
        return res.status(404).json({ message: 'Organization not found' });
      }
      await organization.destroy();
      res.json({ message: 'Organization deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting organization', error: error.message });
    }
  },
};

module.exports = organizationController;
