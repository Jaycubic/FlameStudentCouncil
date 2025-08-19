import { useState, useEffect } from 'react'

import PropTypes from 'prop-types'
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
} from '@chakra-ui/react'
import { roleService } from '../../services/roleService'
import { userService } from '../../services/userService'

function UserForm({ user, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    employeeCode: user?.employeeCode || '',
    employeeName: user?.employeeName || '',
    username: user?.username || '',
    email: user?.email || '',
    userType: user?.userType || '',
    password: '',
    confirmPassword: '',
  })

  const [roles, setRoles] = useState([])
  const [errors, setErrors] = useState({})
  const toast = useToast()

  // Fetch roles when component mounts
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const rolesData = await roleService.getRoles()
        setRoles(rolesData)
      } catch (error) {
        toast({
          title: 'Error loading roles',
          description: 'Could not load available roles',
          status: 'error',
          duration: 3000,
        })
      }
    }
    loadRoles()
  }, [])

  // Fetch employee details when employeeCode changes
  useEffect(() => {
    const timer = setTimeout(() => {
      const code = formData.employeeCode.trim()
      if (code !== '') {
        userService.getEmployeeByCode(code)
          .then((data) => {
            if (data) {
              const { EmployeeName, Batch, Email } = data
              setFormData(prev => ({
                ...prev,
                employeeName: EmployeeName || '',
                email: Email || '',
                username: `${(EmployeeName || '').replace(/\s+/g, '')}${(Batch || '').replace(/\s+/g, '')}`
              }))
            }
          })
          .catch((err) => {
            console.error('Error fetching employee data:', err)
            toast({
              title: 'Error fetching employee',
              description: 'Could not fetch employee details',
              status: 'error',
              duration: 3000,
            })
          })
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [formData.employeeCode])

  const validateForm = () => {
    const newErrors = {}

    // EmployeeCode validation
    if (!formData.employeeCode.trim()) {
      newErrors.employeeCode = 'Employee Code is required'
    }

    // EmployeeName validation
    if (!formData.employeeName.trim()) {
      newErrors.employeeName = 'Employee Name is required'
    }

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required'
    } else if (formData.username.length < 2) {
      newErrors.username = 'Username must be at least 2 characters'
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // UserType validation
    if (!formData.userType) {
      newErrors.userType = 'Please select a role'
    }

    // Password validation for Admin
    if (formData.userType === 'Admin') {
      if (!formData.password || formData.password.length <= 6) {
        newErrors.password = 'Password must be longer than 6 characters'
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (validateForm()) {
      try {
        const submitData = {
          employeeCode: formData.employeeCode,
          employeeName: formData.employeeName,
          username: formData.username,
          email: formData.email,
          userType: formData.userType,
        }
        if (formData.userType === 'Admin') {
          submitData.password = formData.password
          submitData.confirmPassword = formData.confirmPassword
        }
        await userService.createUser(submitData)
        onSubmit(submitData)
        toast({
          title: 'Success',
          description: 'User created successfully',
          status: 'success',
          duration: 3000,
        })
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to create user',
          status: 'error',
          duration: 3000,
        })
      }
    } else {
      toast({
        title: 'Form Validation Error',
        description: 'Please check the form for errors',
        status: 'error',
        duration: 3000,
      })
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: undefined }))
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <VStack spacing={4}>
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

        <FormControl isInvalid={!!errors.userType} isRequired>
          <FormLabel>Role</FormLabel>
          <Select
            name="userType"
            value={formData.userType}
            onChange={handleChange}
            placeholder="Select Role"
          >
            {roles.map((role) => (
              <option key={role.id} value={role.Name}>
                {role.Name}
              </option>
            ))}
          </Select>
          <FormErrorMessage>{errors.userType}</FormErrorMessage>
        </FormControl>

        {formData.userType === 'Admin' && (
          <>
            <FormControl isInvalid={!!errors.password} isRequired>
              <FormLabel>Password</FormLabel>
              <Input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter password"
                onBlur={() => validateForm()}
              />
              <FormErrorMessage>{errors.password}</FormErrorMessage>
            </FormControl>

            <FormControl isInvalid={!!errors.confirmPassword} isRequired>
              <FormLabel>Confirm Password</FormLabel>
              <Input
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                onBlur={() => validateForm()}
              />
              <FormErrorMessage>{errors.confirmPassword}</FormErrorMessage>
            </FormControl>
          </>
        )}

        <HStack spacing={3} width="full" justify="flex-end" pt={4}>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" colorScheme="blue">
            {user ? 'Update' : 'Create'} User
          </Button>
        </HStack>
      </VStack>
    </form>
  )
}

UserForm.propTypes = {
  user: PropTypes.shape({
    employeeCode: PropTypes.string,
    employeeName: PropTypes.string,
    username: PropTypes.string,
    email: PropTypes.string,
    userType: PropTypes.string,
  }),
  onSubmit: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
}

export default UserForm
