import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  FormControl,
  FormLabel,
  Input,
  Select,
  Button,
  VStack,
  FormErrorMessage,
  useToast,
  HStack,
  InputGroup,
  InputRightElement,
  IconButton,
} from '@chakra-ui/react';
import { roleService } from '../../services/roleService';
import { userService } from '../../services/userService';
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons';

function UserForm({ user, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    employeeCode: user?.employeeCode || '',
    employeeName: user?.employeeName || '',
    department: user?.department || '',
    username: user?.username || '',
    email: user?.email || '',
    roleId: user?.roleId || '',
    password: '',
    confirmPassword: '',
  });
  const [roles, setRoles] = useState([]);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const rolesData = await roleService.getRoles();
        setRoles(rolesData);
      } catch (error) {
        toast({
          title: 'Error loading roles',
          description: 'Could not load available roles',
          status: 'error',
          duration: 3000,
        });
      }
    };
    loadRoles();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const code = formData.employeeCode.trim();
      if (code !== '') {
        userService.getEmployeeByCode(code)
          .then((data) => {
            if (data) {
              const { EmployeeName, Batch, Email } = data;
              setFormData(prev => ({
                ...prev,
                employeeName: EmployeeName || '',
                department: Batch || '',
                email: Email || '',
                username: EmployeeName || '',
              }));
            }
          })
          .catch((err) => {
            console.error('Error fetching employee data:', err);
            toast({
              title: 'Error fetching employee',
              description: 'Could not fetch employee details',
              status: 'error',
              duration: 3000,
            });
          });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.employeeCode]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.employeeCode.trim()) newErrors.employeeCode = 'Employee Code is required';
    if (!formData.employeeName.trim()) newErrors.employeeName = 'Employee Name is required';
    if (!formData.department.trim()) newErrors.department = 'Department is required';
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 2) {
      newErrors.username = 'Username must be at least 2 characters';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.roleId) newErrors.roleId = 'Please select a role';

    const selectedRoleName = roles.find(role => role.id === parseInt(formData.roleId, 10))?.name.toLowerCase();
    if (['admin', 'user'].includes(selectedRoleName) && !user) {
      if (!formData.password || formData.password.length <= 6) {
        newErrors.password = 'Password must be longer than 6 characters';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        const submitData = {
          employeeCode: formData.employeeCode,
          employeeName: formData.employeeName,
          department: formData.department,
          username: formData.username,
          email: formData.email,
          roleId: parseInt(formData.roleId, 10),
        };
        const selectedRoleName = roles.find(role => role.id === parseInt(formData.roleId, 10))?.name.toLowerCase();
        if (['admin', 'user'].includes(selectedRoleName)) {
          submitData.password = formData.password;
        }
        console.log('Submitting data:', submitData);
        await userService.createUser(submitData);
        onSubmit(submitData);
        toast({
          title: 'Success',
          description: 'User created successfully',
          status: 'success',
          duration: 3000,
        });
      } catch (error) {
        console.error('Submission error:', error.response?.data);
        toast({
          title: 'Error',
          description: error.response?.data?.message || (user ? 'Failed to update user' : 'Failed to create user'),
          status: 'error',
          duration: 3000,
        });
      } finally {
        setIsSubmitting(false);
      }
    } else {
      toast({
        title: 'Form Validation Error',
        description: 'Please check the form for errors',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack spacing={4} maxH="70vh" overflowY="auto">
        <FormControl isInvalid={!!errors.employeeCode} isRequired>
          <FormLabel>Employee Code</FormLabel>
          <Input
            name="employeeCode"
            value={formData.employeeCode}
            onChange={handleChange}
            placeholder="Enter employee code"
            onBlur={() => validateForm()}
          />
          <FormErrorMessage>{errors.employeeCode}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.employeeName} isRequired>
          <FormLabel>Employee Name</FormLabel>
          <Input
            name="employeeName"
            value={formData.employeeName}
            onChange={handleChange}
            placeholder="Enter employee name"
            onBlur={() => validateForm()}
          />
          <FormErrorMessage>{errors.employeeName}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.department} isRequired>
          <FormLabel>Department</FormLabel>
          <Input
            name="department"
            value={formData.department}
            onChange={handleChange}
            placeholder="Enter department"
            onBlur={() => validateForm()}
          />
          <FormErrorMessage>{errors.department}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.username} isRequired>
          <FormLabel>Username</FormLabel>
          <Input
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="Enter username"
            onBlur={() => validateForm()}
          />
          <FormErrorMessage>{errors.username}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.email} isRequired>
          <FormLabel>Email</FormLabel>
          <Input
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter email address"
            onBlur={() => validateForm()}
          />
          <FormErrorMessage>{errors.email}</FormErrorMessage>
        </FormControl>
        <FormControl isInvalid={!!errors.roleId} isRequired>
          <FormLabel>Role</FormLabel>
          <Select
            name="roleId"
            value={formData.roleId}
            onChange={handleChange}
            placeholder="Select Role"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </Select>
          <FormErrorMessage>{errors.roleId}</FormErrorMessage>
        </FormControl>
        {roles.find(role => role.id === parseInt(formData.roleId, 10))?.name.toLowerCase() !== 'rc' && (
          <>
            <FormControl isInvalid={!!errors.password} isRequired={!user}>
              <FormLabel>Password</FormLabel>
              <InputGroup>
                <Input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  onBlur={() => validateForm()}
                />
                <InputRightElement>
                  <IconButton
                    variant="ghost"
                    icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                    onClick={() => setShowPassword(!showPassword)}
                  />
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage>{errors.password}</FormErrorMessage>
            </FormControl>
            <FormControl isInvalid={!!errors.confirmPassword} isRequired={!user}>
              <FormLabel>Confirm Password</FormLabel>
              <InputGroup>
                <Input
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm password"
                  onBlur={() => validateForm()}
                />
                <InputRightElement>
                  <IconButton
                    variant="ghost"
                    icon={showConfirmPassword ? <ViewOffIcon /> : <ViewIcon />}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                </InputRightElement>
              </InputGroup>
              <FormErrorMessage>{errors.confirmPassword}</FormErrorMessage>
            </FormControl>
          </>
        )}
        <HStack spacing={3} width="full" justify="flex-end" pt={4}>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" colorScheme="blue" isLoading={isSubmitting}>
            {user ? 'Update' : 'Create'} User
          </Button>
        </HStack>
      </VStack>
    </form>
  );
}

UserForm.propTypes = {
  user: PropTypes.shape({
    employeeCode: PropTypes.string,
    employeeName: PropTypes.string,
    department: PropTypes.string,
    username: PropTypes.string,
    email: PropTypes.string,
    roleId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default UserForm;
