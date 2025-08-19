// src/components/roles/RolePermissions.jsx
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  VStack,
  Checkbox,
  Button,
  Text,
  HStack,
  Divider,
} from '@chakra-ui/react';

function RolePermissions({ role, onSave, onCancel }) {
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  useEffect(() => {
    if (Array.isArray(role?.permissions)) {
      setSelectedPermissions(role.permissions);
    }
  }, [role]);

  const handlePermissionToggle = (permission) => {
    setSelectedPermissions(prev => 
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(selectedPermissions);
  };

  return (
    <Box as="form" onSubmit={handleSubmit}>
      <VStack spacing={6} align="stretch">
        <Box>
          <Text fontWeight="medium" color="gray.700" mb={2}>Permissions</Text>
          <VStack align="stretch" spacing={2} pl={4}>
            {/** Map over every permission on the role */}
            {role?.permissions.map(permission => (
              <Checkbox
                key={permission}
                isChecked={selectedPermissions.includes(permission)}
                onChange={() => handlePermissionToggle(permission)}
                colorScheme="vrv"
              >
                <Text fontSize="sm">{permission}</Text>
              </Checkbox>
            ))}
          </VStack>
          <Divider mt={4} />
        </Box>
      </VStack>

      <HStack justify="flex-end" mt={6} spacing={3}>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" colorScheme="vrv">
          Save Permissions
        </Button>
      </HStack>
    </Box>
  );
}

RolePermissions.propTypes = {
  role: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string,
    permissions: PropTypes.arrayOf(PropTypes.string),
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default RolePermissions;
