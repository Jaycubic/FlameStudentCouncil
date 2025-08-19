import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  VStack,
  useDisclosure,
  Flex,
  Text,
  Card,
  useToast,
  useColorModeValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  FormErrorMessage,
  IconButton,
  InputGroup,
  InputLeftElement,
} from '@chakra-ui/react';
import {
  PlusIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  UsersIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { departmentService } from '../services/departmentService';
import { locationService } from '../services/locationService';
import { organizationService } from '../services/organizationService';
import { userService } from '../services/userService';
import { counterService } from '../services/counterService';
import UserForm from '../components/users/UserForm';
import AssignCounterForm from './AssignCounterForm';
import { format } from 'date-fns';

function Services() {
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [counters, setCounters] = useState([]);
  const [selectedModal, setSelectedModal] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const { isOpen: isModalOpen, onOpen: onModalOpen, onClose: onModalClose } = useDisclosure();
  const { isOpen: isAssignOpen, onOpen: onAssignOpen, onClose: onAssignClose } = useDisclosure();
  const { isOpen: isUserFormOpen, onOpen: onUserFormOpen, onClose: onUserFormClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure();
  const { isOpen: isAddFormOpen, onOpen: onAddFormOpen, onClose: onAddFormClose } = useDisclosure();
  const { isOpen: isEditFormOpen, onOpen: onEditFormOpen, onClose: onEditFormClose } = useDisclosure();
  const { isOpen: isDeleteItemOpen, onOpen: onDeleteItemOpen, onClose: onDeleteItemClose } = useDisclosure();
  const [formType, setFormType] = useState(null);
  const [orgFormData, setOrgFormData] = useState({
    name: '', address: '', phoneNumber: '', email: '', websiteLink: '',
    contactPersonName: '', contactPersonMobile: '', personEmail: '', gstNumber: '',
  });
  const [locFormData, setLocFormData] = useState({ locationName: '', OrganizationName: '', DeviceId: '' });
  const [deptFormData, setDeptFormData] = useState({ departmentName: '', locationName: '', hodName: '', hodEmail: '' });
  const [formErrors, setFormErrors] = useState({});
  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

  // Define gradient styles for buttons
  const buttonBg = useColorModeValue(
    'linear(to-r, blue.500, blue.400)',
    'linear(to-r, purple.600, pink.400)'
  );
  const buttonHoverBg = useColorModeValue(
    'linear(to-r, blue.300, blue.200)',
    'linear(to-r, purple.500, pink.300)'
  );

  useEffect(() => {
    loadData();
    loadUsers();
    loadCounters();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      setDepartments(await departmentService.getDepartments());
      setLocations(await locationService.getLocations());
      setOrganizations(await organizationService.getOrganizations());
    } catch (error) {
      toast({ title: 'Error loading data', description: error.message, status: 'error', duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const allUsers = await userService.getUsers();
      const userRoleUsers = allUsers.filter(u => u.Role?.name.toLowerCase() === 'user');
      setUsers(userRoleUsers);
    } catch (error) {
      toast({ title: 'Error loading users', description: error.message, status: 'error', duration: 3000 });
    }
  };

  const loadCounters = async () => {
    try {
      const countersData = await counterService.getCounters();
      setCounters(countersData);
    } catch (error) {
      toast({ title: 'Error loading counters', description: error.message, status: 'error', duration: 3000 });
    }
  };

  const openModal = (type) => {
    setSelectedModal(type);
    onModalOpen();
  };

  const handleAddOpen = (type) => {
    setFormType(type);
    setSelectedItem(null);
    if (type === 'organization') setOrgFormData({
      name: '', address: '', phoneNumber: '', email: '', websiteLink: '',
      contactPersonName: '', contactPersonMobile: '', personEmail: '', gstNumber: '',
    });
    if (type === 'location') setLocFormData({ locationName: '', OrganizationName: '', DeviceId: '' });
    if (type === 'department') setDeptFormData({ departmentName: '', locationName: '', hodName: '', hodEmail: '' });
    setFormErrors({});
    onAddFormOpen();
  };

  const handleEditItem = (item) => {
    setSelectedItem(item);
    if (selectedModal === 'organization') setOrgFormData(item);
    if (selectedModal === 'location') setLocFormData(item);
    if (selectedModal === 'department') setDeptFormData(item);
    setFormType(selectedModal);
    setFormErrors({});
    onEditFormOpen();
  };

  const handleDeleteItem = (item) => {
    setSelectedItem(item);
    onDeleteItemOpen();
  };

  const handleFormChange = (e, formSetter) => {
    const { name, value } = e.target;
    formSetter(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: undefined }));
  };

  const validateOrgForm = () => {
    const errors = {};
    if (!orgFormData.name) errors.name = 'Name is required';
    if (!orgFormData.address) errors.address = 'Address is required';
    if (!orgFormData.phoneNumber) errors.phoneNumber = 'Phone Number is required';
    if (!orgFormData.email) errors.email = 'Email is required';
    if (!orgFormData.contactPersonName) errors.contactPersonName = 'Contact Person Name is required';
    if (!orgFormData.contactPersonMobile) errors.contactPersonMobile = 'Contact Person Mobile is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateLocForm = () => {
    const errors = {};
    if (!locFormData.locationName) errors.locationName = 'Location Name is required';
    if (!locFormData.OrganizationName) errors.OrganizationName = 'Organization is required';
    if (!locFormData.DeviceId) errors.DeviceId = 'Device ID is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateDeptForm = () => {
    const errors = {};
    if (!deptFormData.departmentName) errors.departmentName = 'Department Name is required';
    if (!deptFormData.locationName) errors.locationName = 'Location is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    let isValid = false;
    try {
      if (formType === 'organization') {
        isValid = validateOrgForm();
        if (isValid) {
          if (selectedItem) {
            await organizationService.updateOrganization(selectedItem.id, orgFormData);
            setOrganizations(organizations.map(org => org.id === selectedItem.id ? { ...org, ...orgFormData } : org));
            toast({ title: 'Organization updated', status: 'success', duration: 3000 });
          } else {
            await organizationService.createOrganization(orgFormData);
            setOrganizations(await organizationService.getOrganizations());
            toast({ title: 'Organization created', status: 'success', duration: 3000 });
          }
        }
      } else if (formType === 'location') {
        isValid = validateLocForm();
        if (isValid) {
          if (selectedItem) {
            await locationService.updateLocation(selectedItem.id, locFormData);
            setLocations(locations.map(loc => loc.id === selectedItem.id ? { ...loc, ...locFormData } : loc));
            toast({ title: 'Location updated', status: 'success', duration: 3000 });
          } else {
            await locationService.createLocation(locFormData);
            setLocations(await locationService.getLocations());
            toast({ title: 'Location created', status: 'success', duration: 3000 });
          }
        }
      } else if (formType === 'department') {
        isValid = validateDeptForm();
        if (isValid) {
          if (selectedItem) {
            await departmentService.updateDepartment(selectedItem.id, deptFormData);
            setDepartments(departments.map(dept => dept.id === selectedItem.id ? { ...dept, ...deptFormData } : dept));
            toast({ title: 'Department updated', status: 'success', duration: 3000 });
          } else {
            await departmentService.createDepartment(deptFormData);
            setDepartments(await departmentService.getDepartments());
            toast({ title: 'Department created', status: 'success', duration: 3000 });
          }
        }
      }
      if (isValid) {
        if (selectedItem) onEditFormClose(); else onAddFormClose();
        setSelectedItem(null);
      }
    } catch (error) {
      toast({
        title: `Error ${selectedItem ? 'updating' : 'creating'} ${formType}`,
        description: error.response?.data?.message || 'An error occurred',
        status: 'error',
        duration: 3000,
      });
    }
    if (!isValid) toast({ title: 'Validation Error', description: 'Please check the form', status: 'error', duration: 3000 });
  };

  const handleDeleteConfirm = async () => {
    try {
      if (selectedModal === 'organization') {
        await organizationService.deleteOrganization(selectedItem.id);
        setOrganizations(organizations.filter(org => org.id !== selectedItem.id));
        toast({ title: 'Organization deleted', status: 'success', duration: 3000 });
      } else if (selectedModal === 'location') {
        await locationService.deleteLocation(selectedItem.id);
        setLocations(locations.filter(loc => loc.id !== selectedItem.id));
        toast({ title: 'Location deleted', status: 'success', duration: 3000 });
      } else if (selectedModal === 'department') {
        await departmentService.deleteDepartment(selectedItem.id);
        setDepartments(departments.filter(dept => dept.id !== selectedItem.id));
        toast({ title: 'Department deleted', status: 'success', duration: 3000 });
      }
      onDeleteItemClose();
    } catch (error) {
      toast({
        title: `Error deleting ${selectedModal}`,
        description: error.response?.data?.message || 'An error occurred',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleAssignSubmit = async (data) => {
    try {
      await userService.createUser(data);
      loadUsers();
      onAssignClose();
      toast({ title: 'Counter assigned', status: 'success', duration: 3000 });
    } catch (error) {
      toast({
        title: 'Error assigning counter',
        description: error.response?.data?.message || 'An error occurred',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleEditUser = (user) => {
    setSelectedUser({
      id: user.id,
      employeeCode: user.UserID.toString(),
      employeeName: user.username,
      department: user.Department,
      username: user.username,
      email: user.email,
      roleId: user.roleId,
      CounterId: user.CounterId,
    });
    onUserFormOpen();
  };

  const handleUserSubmit = async (data) => {
    try {
      if (selectedUser) {
        await userService.updateUser(selectedUser.id, data);
        toast({ title: 'User updated', status: 'success', duration: 3000 });
      }
      loadUsers();
      onUserFormClose();
    } catch (error) {
      toast({
        title: 'Error saving user',
        description: error.response?.data?.message || 'An error occurred',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    openDelete();
  };

  const handleUserDeleteConfirm = async () => {
    try {
      await userService.deleteUser(userToDelete.id);
      toast({ title: 'User deleted', status: 'success', duration: 3000 });
      loadUsers();
      closeDelete();
    } catch (error) {
      toast({
        title: 'Error deleting user',
        description: error.response?.data?.message || 'An error occurred',
        status: 'error',
        duration: 3000,
      });
    }
  };

  const formatDate = date => {
    try { return format(new Date(date), 'MMM dd, yyyy'); }
    catch { return 'N/A'; }
  };

  const getCounterName = (counterId) => {
    const counter = counters.find(c => c.id === counterId);
    return counter ? counter.CounterName : 'N/A';
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const renderTable = () => {
    const data = selectedModal === 'department' ? departments : selectedModal === 'location' ? locations : organizations;
    const columns = selectedModal === 'department' ? 
      ['ID', 'Name', 'Location', 'HOD Name', 'HOD Email', 'Created At', 'Actions'] :
      selectedModal === 'location' ?
      ['ID', 'Name', 'Organization', 'Device ID', 'Created At', 'Actions'] :
      ['ID', 'Name', 'Address', 'Phone Number', 'Email', 'Created At', 'Actions'];

    return (
      <Box maxH="300px" overflowY="auto">
        <Table>
          <Thead position="sticky" top={0} zIndex={1}>
            <Tr bg={gradientBg}>
              {columns.map((col, index) => (
                <Th key={index} color="white" borderColor="white">{col}</Th>
              ))}
            </Tr>
          </Thead>
          <Tbody>
            {isLoading ? (
              <Tr>
                <Td colSpan={columns.length} textAlign="center" py={8} borderColor={borderColor}>
                  Loading...
                </Td>
              </Tr>
            ) : data.length === 0 ? (
              <Tr>
                <Td colSpan={columns.length} textAlign="center" py={8} borderColor={borderColor}>
                  No {selectedModal}s found
                </Td>
              </Tr>
            ) : (
              data.map(item => (
                <Tr key={item.id}>
                  <Td borderColor={borderColor}>{item.id}</Td>
                  <Td borderColor={borderColor}>
                    {selectedModal === 'department' ? item.departmentName : selectedModal === 'location' ? item.locationName : item.name}
                  </Td>
                  {selectedModal === 'department' && (
                    <>
                      <Td borderColor={borderColor}>{item.locationName}</Td>
                      <Td borderColor={borderColor}>{item.hodName || 'N/A'}</Td>
                      <Td borderColor={borderColor}>{item.hodEmail || 'N/A'}</Td>
                    </>
                  )}
                  {selectedModal === 'location' && (
                    <>
                      <Td borderColor={borderColor}>{item.OrganizationName}</Td>
                      <Td borderColor={borderColor}>{item.DeviceId}</Td>
                    </>
                  )}
                  {selectedModal === 'organization' && (
                    <>
                      <Td borderColor={borderColor}>{item.address}</Td>
                      <Td borderColor={borderColor}>{item.phoneNumber}</Td>
                      <Td borderColor={borderColor}>{item.email}</Td>
                    </>
                  )}
                  <Td borderColor={borderColor}>{formatDate(item.createdAt)}</Td>
                  <Td borderColor={borderColor}>
                    <HStack spacing={2}>
                      <IconButton
                        icon={<PencilSquareIcon className="h-4 w-4" />}
                        aria-label="Edit"
                        onClick={() => handleEditItem(item)}
                      />
                      <IconButton
                        icon={<TrashIcon className="h-4 w-4" />}
                        aria-label="Delete"
                        colorScheme="red"
                        onClick={() => handleDeleteItem(item)}
                      />
                    </HStack>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Box>
    );
  };

  const renderAddForm = () => {
    const isEditing = !!selectedItem;
    const title = isEditing ? `Edit ${formType}` : `Add New ${formType}`;

    if (formType === 'organization') {
      return (
        <Box maxH="60vh" overflowY="auto">
          <form onSubmit={handleFormSubmit}>
            <VStack spacing={4}>
              <Text fontSize="xl" fontWeight="bold">{title}</Text>
              <FormControl isInvalid={!!formErrors.name} isRequired>
                <FormLabel>Name</FormLabel>
                <Input name="name" value={orgFormData.name} onChange={(e) => handleFormChange(e, setOrgFormData)} />
                <FormErrorMessage>{formErrors.name}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!formErrors.address} isRequired>
                <FormLabel>Address</FormLabel>
                <Input name="address" value={orgFormData.address} onChange={(e) => handleFormChange(e, setOrgFormData)} />
                <FormErrorMessage>{formErrors.address}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!formErrors.phoneNumber} isRequired>
                <FormLabel>Phone Number</FormLabel>
                <Input name="phoneNumber" value={orgFormData.phoneNumber} onChange={(e) => handleFormChange(e, setOrgFormData)} />
                <FormErrorMessage>{formErrors.phoneNumber}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!formErrors.email} isRequired>
                <FormLabel>Email</FormLabel>
                <Input name="email" value={orgFormData.email} onChange={(e) => handleFormChange(e, setOrgFormData)} />
                <FormErrorMessage>{formErrors.email}</FormErrorMessage>
              </FormControl>
              <FormControl>
                <FormLabel>Website Link</FormLabel>
                <Input name="websiteLink" value={orgFormData.websiteLink} onChange={(e) => handleFormChange(e, setOrgFormData)} />
              </FormControl>
              <FormControl isInvalid={!!formErrors.contactPersonName} isRequired>
                <FormLabel>Contact Person Name</FormLabel>
                <Input name="contactPersonName" value={orgFormData.contactPersonName} onChange={(e) => handleFormChange(e, setOrgFormData)} />
                <FormErrorMessage>{formErrors.contactPersonName}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!formErrors.contactPersonMobile} isRequired>
                <FormLabel>Contact Person Mobile</FormLabel>
                <Input name="contactPersonMobile" value={orgFormData.contactPersonMobile} onChange={(e) => handleFormChange(e, setOrgFormData)} />
                <FormErrorMessage>{formErrors.contactPersonMobile}</FormErrorMessage>
              </FormControl>
              <FormControl>
                <FormLabel>Person Email</FormLabel>
                <Input name="personEmail" value={orgFormData.personEmail} onChange={(e) => handleFormChange(e, setOrgFormData)} />
              </FormControl>
              <FormControl>
                <FormLabel>GST Number</FormLabel>
                <Input name="gstNumber" value={orgFormData.gstNumber} onChange={(e) => handleFormChange(e, setOrgFormData)} />
              </FormControl>
              <HStack spacing={3} width="full" justify="flex-end" pt={4}>
                <Button variant="outline" onClick={isEditing ? onEditFormClose : onAddFormClose}>Cancel</Button>
                <Button type="submit" colorScheme="blue">{isEditing ? 'Update' : 'Save'}</Button>
              </HStack>
            </VStack>
          </form>
        </Box>
      );
    } else if (formType === 'location') {
      return (
        <Box maxH="60vh" overflowY="auto">
          <form onSubmit={handleFormSubmit}>
            <VStack spacing={4}>
              <Text fontSize="xl" fontWeight="bold">{title}</Text>
              <FormControl isInvalid={!!formErrors.locationName} isRequired>
                <FormLabel>Location Name</FormLabel>
                <Input name="locationName" value={locFormData.locationName} onChange={(e) => handleFormChange(e, setLocFormData)} />
                <FormErrorMessage>{formErrors.locationName}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!formErrors.OrganizationName} isRequired>
                <FormLabel>Organization</FormLabel>
                <Select
                  name="OrganizationName"
                  value={locFormData.OrganizationName}
                  onChange={(e) => handleFormChange(e, setLocFormData)}
                  placeholder="Select organization"
                >
                  {organizations.map(org => (
                    <option key={org.id} value={org.name}>{org.name}</option>
                  ))}
                </Select>
                <FormErrorMessage>{formErrors.OrganizationName}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!formErrors.DeviceId} isRequired>
                <FormLabel>Device ID</FormLabel>
                <Input name="DeviceId" value={locFormData.DeviceId} onChange={(e) => handleFormChange(e, setLocFormData)} />
                <FormErrorMessage>{formErrors.DeviceId}</FormErrorMessage>
              </FormControl>
              <HStack spacing={3} width="full" justify="flex-end" pt={4}>
                <Button variant="outline" onClick={isEditing ? onEditFormClose : onAddFormClose}>Cancel</Button>
                <Button type="submit" colorScheme="blue">{isEditing ? 'Update' : 'Save'}</Button>
              </HStack>
            </VStack>
          </form>
        </Box>
      );
    } else if (formType === 'department') {
      return (
        <Box maxH="60vh" overflowY="auto">
          <form onSubmit={handleFormSubmit}>
            <VStack spacing={4}>
              <Text fontSize="xl" fontWeight="bold">{title}</Text>
              <FormControl isInvalid={!!formErrors.departmentName} isRequired>
                <FormLabel>Department Name</FormLabel>
                <Input name="departmentName" value={deptFormData.departmentName} onChange={(e) => handleFormChange(e, setDeptFormData)} />
                <FormErrorMessage>{formErrors.departmentName}</FormErrorMessage>
              </FormControl>
              <FormControl isInvalid={!!formErrors.locationName} isRequired>
                <FormLabel>Location</FormLabel>
                <Select
                  name="locationName"
                  value={deptFormData.locationName}
                  onChange={(e) => handleFormChange(e, setDeptFormData)}
                  placeholder="Select location"
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.locationName}>{loc.locationName}</option>
                  ))}
                </Select>
                <FormErrorMessage>{formErrors.locationName}</FormErrorMessage>
              </FormControl>
              <FormControl>
                <FormLabel>HOD Name</FormLabel>
                <Input name="hodName" value={deptFormData.hodName} onChange={(e) => handleFormChange(e, setDeptFormData)} />
              </FormControl>
              <FormControl>
                <FormLabel>HOD Email</FormLabel>
                <Input name="hodEmail" value={deptFormData.hodEmail} onChange={(e) => handleFormChange(e, setDeptFormData)} />
              </FormControl>
              <HStack spacing={3} width="full" justify="flex-end" pt={4}>
                <Button variant="outline" onClick={isEditing ? onEditFormClose : onAddFormClose}>Cancel</Button>
                <Button type="submit" colorScheme="blue">{isEditing ? 'Update' : 'Save'}</Button>
              </HStack>
            </VStack>
          </form>
        </Box>
      );
    }
  };

  return (
    <Box p={8}>
      <Card variant="outline" bg={bgColor} border="1px solid" borderColor="#304945" overflow="hidden">
        <Box px={6} py={4}>
          <Flex justify="space-between" align="center" mb={3}>
            <Text fontSize="2xl" fontWeight="bold">Queue Services</Text>
            <HStack spacing={3}>
              <Button
                bgGradient={buttonBg}
                color="white"
                _hover={{ bgGradient: buttonHoverBg }}
                leftIcon={<MapPinIcon className="h-5 w-5" />}
                onClick={() => openModal('location')}
              >
                Location
              </Button>
              <Button
                bgGradient={buttonBg}
                color="white"
                _hover={{ bgGradient: buttonHoverBg }}
                leftIcon={<BuildingOfficeIcon className="h-5 w-5" />}
                onClick={() => openModal('organization')}
              >
                Organization
              </Button>
              <Button
                bgGradient={buttonBg}
                color="white"
                _hover={{ bgGradient: buttonHoverBg }}
                leftIcon={<UsersIcon className="h-5 w-5" />}
                onClick={() => openModal('department')}
              >
                Department
              </Button>
              <Button
                bgGradient={buttonBg}
                color="white"
                _hover={{ bgGradient: buttonHoverBg }}
                leftIcon={<PlusIcon className="h-5 w-5" />}
                onClick={onAssignOpen}
              >
                Assign Counter
              </Button>
            </HStack>
          </Flex>
          <Text color={textColor} fontSize="sm">
            Manage locations, organizations, and departments
          </Text>
        </Box>

        <Box mt={2} ml={4}>
          <InputGroup maxW="300px" mb={3}>
            <InputLeftElement pointerEvents="none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </InputLeftElement>
            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </InputGroup>
          <Text fontSize="xl" fontWeight="bold" mb={4}>Assigned Counters Members</Text>
          <Box maxH="400px" overflowY="auto">
            <Table>
              <Thead position="sticky" top={0} zIndex={1}>
                <Tr bg={gradientBg}>
                  <Th color="white" borderColor="white">ID</Th>
                  <Th color="white" borderColor="white">Name</Th>
                  <Th color="white" borderColor="white">Department</Th>
                  <Th color="white" borderColor="white">Counter</Th>
                  <Th color="white" borderColor="white">Email</Th>
                  <Th color="white" borderColor="white">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredUsers.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} textAlign="center" py={8} borderColor={borderColor}>
                      No counters members found
                    </Td>
                  </Tr>
                ) : (
                  paginatedUsers.map(user => (
                    <Tr key={user.id}>
                      <Td borderColor={borderColor}>{user.id}</Td>
                      <Td borderColor={borderColor}>{user.username}</Td>
                      <Td borderColor={borderColor}>{user.Department}</Td>
                      <Td borderColor={borderColor}>{getCounterName(user.CounterId)}</Td>
                      <Td borderColor={borderColor}>{user.email}</Td>
                      <Td borderColor={borderColor}>
                        <HStack spacing={2}>
                          <IconButton
                            icon={<PencilSquareIcon className="h-4 w-4" />}
                            aria-label="Edit"
                            onClick={() => handleEditUser(user)}
                          />
                          <IconButton
                            icon={<TrashIcon className="h-4 w-4" />}
                            aria-label="Delete"
                            colorScheme="red"
                            onClick={() => handleDeleteClick(user)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Box>
          <HStack justify="center" mt={4}>
            <IconButton
              icon={<ChevronLeftIcon className="h-5 w-5" />}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              isDisabled={currentPage === 1}
            />
            <Text>Page {currentPage} of {totalPages}</Text>
            <IconButton
              icon={<ChevronRightIcon className="h-5 w-5" />}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              isDisabled={currentPage === totalPages}
            />
          </HStack>
        </Box>
      </Card>

      <Modal isOpen={isModalOpen} onClose={onModalClose}>
        <ModalOverlay />
        <ModalContent maxW="80vw">
          <ModalHeader bg={gradientBg} color="white" borderTopRadius="md">
            {selectedModal ? selectedModal.charAt(0).toUpperCase() + selectedModal.slice(1) : ''}
          </ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody>
            <HStack spacing={3} mb={4} justify="flex-end">
              <Button leftIcon={<PlusIcon className="h-5 w-5" />} colorScheme="blue" onClick={() => handleAddOpen(selectedModal)}>
                Add
              </Button>
            </HStack>
            {selectedModal && renderTable()}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isAssignOpen} onClose={onAssignClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Assign Counter</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <AssignCounterForm departments={departments} onSubmit={handleAssignSubmit} onCancel={onAssignClose} />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isUserFormOpen} onClose={onUserFormClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{selectedUser ? 'Edit User' : 'Add New User'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <UserForm user={selectedUser} onSubmit={handleUserSubmit} onCancel={onUserFormClose} />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={closeDelete}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete User</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box>
              <Text mb={4}>Are you sure you want to delete {userToDelete?.username}? This cannot be undone.</Text>
              <HStack spacing={3} justify="flex-end">
                <Button variant="outline" onClick={closeDelete}>Cancel</Button>
                <Button colorScheme="red" onClick={handleUserDeleteConfirm}>Delete</Button>
              </HStack>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isAddFormOpen} onClose={onAddFormClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Add New {formType ? formType.charAt(0).toUpperCase() + formType.slice(1) : ''}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {renderAddForm()}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isEditFormOpen} onClose={onEditFormClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit {formType ? formType.charAt(0).toUpperCase() + formType.slice(1) : ''}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {renderAddForm()}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isDeleteItemOpen} onClose={onDeleteItemClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Delete {selectedModal ? selectedModal.charAt(0).toUpperCase() + selectedModal.slice(1) : ''}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box>
              <Text mb={4}>Are you sure you want to delete this {selectedModal}? This cannot be undone.</Text>
              <HStack spacing={3} justify="flex-end">
                <Button variant="outline" onClick={onDeleteItemClose}>Cancel</Button>
                <Button colorScheme="red" onClick={handleDeleteConfirm}>Delete</Button>
              </HStack>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default Services;
