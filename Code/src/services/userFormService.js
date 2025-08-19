// src/services/UserFormService.js
import { roleService } from './roleService';

const getRoles = async () => {
  try {
    return await roleService.getRoles();
  } catch (error) {
    throw new Error('Failed to fetch roles');
  }
};

export const userFormService = {
  getRoles,
};