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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Box,
  Text,
} from '@chakra-ui/react';
import { roleService } from '../services/roleService';
import { userService } from '../services/userService';
import { counterService } from '../services/counterService';
import { ViewIcon, ViewOffIcon, AddIcon } from '@chakra-ui/icons';

function AssignCounterForm({ departments, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    employeeCode: '',
    employeeName: '',
    department: '',
    counter: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [roles, setRoles] = useState([]);
  const [counters, setCounters] = useState([]);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCounterModalOpen, setIsCounterModalOpen] = useState(false);
  const [counterFormData, setCounterFormData] = useState({
    CounterName: '',
    DepartmentName: '',
  });
  const [counterErrors, setCounterErrors] = useState({});
  const toast = useToast();

  useEffect(() => {
    const loadRolesAndCounters = async () => {
      try {
        const rolesData = await roleService.getRoles();
        setRoles(rolesData);
        const countersData = await counterService.getCounters();
        setCounters(countersData);
      } catch (error) {
        toast({
          title: 'Error loading data',
          description: error.response?.data?.message || 'Could not load roles or counters',
          status: 'error',
          duration: 3000,
        });
      }
    };
    loadRolesAndCounters();
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
              description: err.response?.data?.message || 'Could not fetch employee details',
              status: 'error',
              duration: 3000,
            });
          });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.employeeCode]);

  const validateField = (name, value) => {
    switch (name) {
      case 'employeeCode':
        return value.trim() ? '' : 'Employee Code is required';
      case 'employeeName':
        return value.trim() ? '' : 'Employee Name is required';
      case 'department':
        return value ? '' : 'Department is required_dont worry about it required';
      case 'counter':
        return value ? '' : 'Counter is required';
      case 'username':
        if (!value.trim()) return 'Username is required';
        if (value.length < 2) return 'Username must be at least 2 characters';
        return '';
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email address';
        return '';
      case 'password':
        if (!value) return 'Password is required';
        if (value.length <= 6) return 'Password must be longer than 6 characters';
        return '';
      case 'confirmPassword':
        if (value !== formData.password) return 'Passwords do not match';
        return '';
      default:
        return '';
    }
  };

  const validateForm = () => {
    const newErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key]);
      if (error) newErrors[key] = error;
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBlur = (e) => {
    // Skip validation if the counter modal is open
    if (isCounterModalOpen) return;
    const { name, value } = e.target;
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      setIsSubmitting(true);
      try {
        const userRole = roles.find(role => role.name.toLowerCase() === 'user');
        if (!userRole) {
          throw new Error('User role not found');
        }
        const submitData = {
          employeeCode: formData.employeeCode,
          employeeName: formData.employeeName,
          department: formData.department,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          CounterId: formData.counter,
          roleId: userRole.id,
        };
        await userService.createUser(submitData);
        onSubmit(submitData);
        toast({
          title: 'Success',
          description: 'Counter assigned successfully',
          status: 'success',
          duration: 3000,
        });
      } catch (error) {
        console.error('Submission error:', error.response?.data);
        toast({
          title: 'Error',
          description: error.response?.data?.message || 'Failed to assign counter',
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

  const handleCounterModalOpen = () => {
    setCounterFormData(prev => ({ ...prev, DepartmentName: formData.department }));
    setIsCounterModalOpen(true);
  };

  const handleCounterModalClose = () => {
    setIsCounterModalOpen(false);
    setCounterFormData({ CounterName: '', DepartmentName: '' });
    setCounterErrors({});
  };

  const handleCounterChange = (e) => {
    const { name, value } = e.target;
    setCounterFormData(prev => ({ ...prev, [name]: value }));
    if (counterErrors[name]) setCounterErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const validateCounterForm = () => {
    const newErrors = {};
    if (!counterFormData.CounterName.trim()) newErrors.CounterName = 'Counter Name is required';
    if (!counterFormData.DepartmentName) newErrors.DepartmentName = 'Department is required';
    setCounterErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCounterSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling up to the main form
    if (validateCounterForm()) {
      try {
        await counterService.createCounter(counterFormData);
        const countersData = await counterService.getCounters();
        setCounters(countersData);
        toast({
          title: 'Success',
          description: 'Counter created successfully',
          status: 'success',
          duration: 3000,
        });
        handleCounterModalClose();
      } catch (error) {
        const message = error.response?.data?.message || 'Failed to create counter';
        toast({
          title: 'Error',
          description: message === 'Counter name already exists in this department' ?
            'Counter name already exists in this department' : message,
          status: 'error',
          duration: 3000,
        });
      }
    } else {
      toast({
        title: 'Form Validation Error',
        description: 'Please check the counter form for errors',
        status: 'error',
        duration: 3000,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <VStack spacing={4} maxH="70vh" overflowY="auto">
        <HStack justify="space-between" width="full">
          <Text fontSize="xl" fontWeight="bold">Assign Counter</Text>
          <Button
            leftIcon={<AddIcon />}
            colorScheme="teal"
            onClick={handleCounterModalOpen}
          >
            Counters
          </Button>
        </HStack>
        <FormControl isInvalid={!!errors.employeeCode} isRequired>
          <FormLabel>Employee Code</FormLabel>
          <Input
            name="employeeCode"
            value={formData.employeeCode}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter employee code"
          />
          <FormErrorMessage>{errors.employeeCode}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.employeeName} isRequired>
          <FormLabel>Employee Name</FormLabel>
          <Input
            name="employeeName"
            value={formData.employeeName}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter employee name"
          />
          <FormErrorMessage>{errors.employeeName}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.department} isRequired>
          <FormLabel>Department</FormLabel>
          <Select
            name="department"
            value={formData.department}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Select department"
          >
            {departments.map(dept => (
              <option key={dept.id} value={dept.departmentName}>{dept.departmentName}</option>
            ))}
          </Select>
          <FormErrorMessage>{errors.department}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.counter} isRequired>
          <FormLabel>Counter</FormLabel>
          <Select
            name="counter"
            value={formData.counter}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Select counter"
            isDisabled={!formData.department}
          >
            {counters
              .filter(counter => counter.DepartmentName === formData.department)
              .map(counter => (
                <option key={counter.id} value={counter.id}>{counter.CounterName}</option>
              ))}
          </Select>
          <FormErrorMessage>{errors.counter}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.username} isRequired>
          <FormLabel>Username</FormLabel>
          <Input
            name="username"
            value={formData.username}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Enter username"
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
            onBlur={handleBlur}
            placeholder="Enter email address"
          />
          <FormErrorMessage>{errors.email}</FormErrorMessage>
        </FormControl>

        <FormControl isInvalid={!!errors.password} isRequired>
          <FormLabel>Password</FormLabel>
          <InputGroup>
            <Input
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Enter password"
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

        <FormControl isInvalid={!!errors.confirmPassword} isRequired>
          <FormLabel>Confirm Password</FormLabel>
          <InputGroup>
            <Input
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={formData.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="Confirm password"
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

        <HStack spacing={3} width="full" justify="flex-end" pt={4}>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" colorScheme="blue" isLoading={isSubmitting}>
            Assign Counter
          </Button>
        </HStack>
      </VStack>

      <Modal isOpen={isCounterModalOpen} onClose={handleCounterModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New Counter</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <form onSubmit={handleCounterSubmit}>
              <VStack spacing={4}>
                <FormControl isInvalid={!!counterErrors.CounterName} isRequired>
                  <FormLabel>Counter Name</FormLabel>
                  <Input
                    name="CounterName"
                    value={counterFormData.CounterName}
                    onChange={handleCounterChange}
                    placeholder="Enter counter name"
                  />
                  <FormErrorMessage>{counterErrors.CounterName}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!counterErrors.DepartmentName} isRequired>
                  <FormLabel>Department</FormLabel>
                  <Select
                    name="DepartmentName"
                    value={counterFormData.DepartmentName}
                    onChange={handleCounterChange}
                    placeholder="Select department"
                  >
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.departmentName}>{dept.departmentName}</option>
                    ))}
                  </Select>
                  <FormErrorMessage>{counterErrors.DepartmentName}</FormErrorMessage>
                </FormControl>
                <HStack spacing={3} width="full" justify="flex-end" pt={4}>
                  <Button variant="outline" onClick={handleCounterModalClose}>
                    Cancel
                  </Button>
                  <Button type="submit" colorScheme="blue">
                    Save
                  </Button>
                </HStack>
              </VStack>
            </form>
          </ModalBody>
        </ModalContent>
      </Modal>
    </form>
  );
}

AssignCounterForm.propTypes = {
  departments: PropTypes.array.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default AssignCounterForm;
