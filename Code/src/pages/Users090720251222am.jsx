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
  IconButton,
  Badge,
  HStack,
  VStack,
  useDisclosure,
  Flex,
  Text,
  Card,
  useToast,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Select,
  Divider,
  useBreakpointValue,
  Spinner,
  Tooltip,
  Tag,
  TagLabel,
} from '@chakra-ui/react';
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  UserCircleIcon,
  MagnifyingGlassIcon,
  KeyIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { userService } from '../services/userService';
import { roleService } from '../services/roleService';
import Modal from '../components/common/Modal';
import UserForm from '../components/users/UserForm';
import RoleForm from '../components/roles/RoleForm';
import RolePermissions from '../components/roles/RolePermissions';
import { format, formatDistanceToNow } from 'date-fns';
import PageHeader from '../components/layout/PageHeader';

function Users() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [roleToDelete, setRoleToDelete] = useState(null);

  const { isOpen: isFormOpen, onOpen: openForm, onClose: closeForm } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: openDelete, onClose: closeDelete } = useDisclosure();
  const { isOpen: isRolesOpen, onOpen: openRoles, onClose: closeRoles } = useDisclosure();
  const { isOpen: isRoleFormOpen, onOpen: openRoleForm, onClose: closeRoleForm } = useDisclosure();
  const { isOpen: isPermissionsOpen, onOpen: openPermissions, onClose: closePermissions } = useDisclosure();
  const { isOpen: isRoleDeleteOpen, onOpen: openRoleDelete, onClose: closeRoleDelete } = useDisclosure();

  const toast = useToast();

  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const headerBg = useColorModeValue('gray.50', 'gray.700');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const userIconBg = useColorModeValue('vrv.100', 'vrv.900');

  const [filters, setFilters] = useState({ search: '', role: '', status: '' });
  const statuses = ['Active', 'Inactive'];
  const displayMode = useBreakpointValue({ base: 'mobile', md: 'desktop' });

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      setUsers(await userService.getUsers());
    } catch {
      toast({ title: 'Error loading users', status: 'error', duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      setRoles(await roleService.getRoles());
    } catch {
      toast({ title: 'Error loading roles', status: 'error', duration: 3000 });
    }
  };

  const handleAddUser = () => { setSelectedUser(null); openForm(); };
  const handleEditUser = user => { setSelectedUser(user); openForm(); };
  const handleDeleteClick = user => { setUserToDelete(user); openDelete(); };
  const handleAddRole = () => { setSelectedRole(null); openRoleForm(); };
  const handleEditRole = role => { setSelectedRole(role); openRoleForm(); };
  const handleDeleteRoleClick = role => { setRoleToDelete(role); openRoleDelete(); };
  const handlePermissionsClick = role => { setSelectedRole(role); openPermissions(); };

  const handleUserSubmit = async data => {
    try {
      selectedUser
        ? await userService.updateUser(selectedUser.id, data)
        : await userService.createUser(data);
      toast({ title: selectedUser ? 'User updated' : 'User created', status: 'success', duration: 3000 });
      loadUsers(); closeForm();
    } catch {
      toast({ title: 'Error saving user', status: 'error', duration: 3000 });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await userService.deleteUser(userToDelete.id);
      toast({ title: 'User deleted', status: 'success', duration: 3000 });
      loadUsers(); closeDelete();
    } catch {
      toast({ title: 'Error deleting user', status: 'error', duration: 3000 });
    }
  };

  const handleRoleSubmit = async data => {
    try {
      selectedRole
        ? await roleService.updateRole(selectedRole.id, data)
        : await roleService.createRole(data);
      toast({ title: selectedRole ? 'Role updated' : 'Role created', status: 'success', duration: 3000 });
      loadRoles(); closeRoleForm();
    } catch {
      toast({ title: 'Error saving role', status: 'error', duration: 3000 });
    }
  };

  const handlePermissionsSubmit = async permissions => {
    try {
      await roleService.updateRole(selectedRole.id, { ...selectedRole, permissions });
      toast({ title: 'Permissions updated', status: 'success', duration: 3000 });
      loadRoles(); closePermissions();
    } catch {
      toast({ title: 'Error updating permissions', status: 'error', duration: 3000 });
    }
  };

  const handleRoleDeleteConfirm = async () => {
    try {
      await roleService.deleteRole(roleToDelete.id);
      toast({ title: 'Role deleted', status: 'success', duration: 3000 });
      loadRoles(); closeRoleDelete();
    } catch {
      toast({ title: 'Error deleting role', status: 'error', duration: 3000 });
    }
  };

  const formatDate = date => {
    try { return format(new Date(date), 'MMM dd, yyyy'); }
    catch { return 'N/A'; }
  };

  const filteredUsers = users.filter(u => {
    const s = filters.search.toLowerCase();
    return (
      (u.username.toLowerCase().includes(s) || u.email.toLowerCase().includes(s) || u.UserID.toString().includes(s)) &&
      (filters.role === '' || u.Role?.name === filters.role) &&
      (filters.status === '' || (u.isActive ? 'Active' : 'Inactive') === filters.status)
    );
  });

  const getRoleBadgeColor = name => {
    switch (name?.toLowerCase()) {
      case 'admin': return 'purple';
      case 'manager': return 'blue';
      case 'employee': return 'green';
      default: return 'gray';
    }
  };

  return (
    <Box p={8}>
      <Card variant="outline" bg={bgColor} border="1px solid" borderColor="#304945" overflow="hidden">
        <Box px={6} py={4}>
          <PageHeader
            title="Users"
            description="Manage system users and roles"
            buttonLabel="Add User"
            buttonIcon={PlusIcon}
            onButtonClick={handleAddUser}
          />
          <VStack spacing={3} mb={4} align="start">
            <Button leftIcon={<KeyIcon className="h-5 w-5" />} onClick={openRoles} colorScheme="blue">
              Roles
            </Button>
          </VStack>

          {/* filters */}
          <Stack direction={{ base: 'column', md: 'row' }} spacing={4} mb={6}>
            <Tooltip label="Search by name, email, or ID" hasArrow>
              <InputGroup maxW={{ md: '300px' }}>
                <InputLeftElement pointerEvents="none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </InputLeftElement>
                <Input
                  placeholder="Search users..."
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                />
              </InputGroup>
            </Tooltip>
            <Select
              placeholder="All Roles"
              value={filters.role}
              onChange={e => setFilters(f => ({ ...f, role: e.target.value }))}
              maxW={{ md: '200px' }}
            >
              {roles.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
            </Select>
            <Select
              placeholder="All Statuses"
              value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              maxW={{ md: '200px' }}
            >
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Stack>

          <Text color={textColor} fontSize="sm" mb={4}>
            Showing {filteredUsers.length} of {users.length} users
          </Text>
        </Box>

        {/* users table/card */}
        <Box>
          {displayMode === 'desktop' ? (
            <Box overflowX="auto">
              <Table>
                <Thead bg={headerBg}>
                  <Tr>
                    <Th borderColor={borderColor}>User ID</Th>
                    <Th borderColor={borderColor}>User Info</Th>
                    <Th borderColor={borderColor}>Role & Status</Th>
                    <Th borderColor={borderColor}>Created At</Th>
                    <Th borderColor={borderColor}>Updated At</Th>
                    <Th borderColor={borderColor}>Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {isLoading ? (
                    <Tr>
                      <Td colSpan={6} textAlign="center" py={8} borderColor={borderColor}>
                        <Spinner size="sm" mr={2} /> Loading...
                      </Td>
                    </Tr>
                  ) : filteredUsers.length === 0 ? (
                    <Tr>
                      <Td colSpan={6} textAlign="center" py={8} borderColor={borderColor}>
                        No users found
                      </Td>
                    </Tr>
                  ) : (
                    filteredUsers.map(u => (
                      <Tr key={u.id}>
                        <Td borderColor={borderColor}>
                          <Text fontFamily="mono" fontSize="sm" color={textColor}>
                            {u.UserID}
                          </Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <HStack spacing={3}>
                            <Box bg={userIconBg} p={2} rounded="lg" color="vrv.500">
                              <UserCircleIcon className="h-5 w-5" />
  </Box>
                            <Box>
                              <Text fontWeight="medium">{u.username}</Text>
                              <Text fontSize="sm" color={textColor}>{u.email}</Text>
                            </Box>
                          </HStack>
                        </Td>
                        <Td borderColor={borderColor}>
                          <VStack align="start" spacing={2}>
                            <Badge colorScheme={getRoleBadgeColor(u.Role?.name)} rounded="full" px={2} py={1}>
                              {u.Role?.name || 'User'}
                            </Badge>
                            <Badge colorScheme={u.isActive ? 'green' : 'red'} rounded="full" px={2} py={1}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </VStack>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{formatDate(u.createdAt)}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{formatDate(u.updatedAt)}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <HStack spacing={2}>
                            <Tooltip label="Edit user" hasArrow>
                              <IconButton
                                icon={<PencilSquareIcon className="h-4 w-4" />}
                                variant="ghost"
                                colorScheme="vrv"
                                size="sm"
                                onClick={() => handleEditUser(u)}
                              />
                            </Tooltip>
                            <Tooltip label="Delete user" hasArrow>
                              <IconButton
                                icon={<TrashIcon className="h-4 w-4" />}
                                variant="ghost"
                                colorScheme="red"
                                size="sm"
                                onClick={() => handleDeleteClick(u)}
                              />
                            </Tooltip>
                          </HStack>
                        </Td>
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </Box>
          ) : (
            <VStack spacing={4} px={4} py={2}>
              {isLoading ? (
                <Flex justify="center" align="center" py={8}>
                  <Spinner size="sm" mr={2} /><Text>Loading...</Text>
                </Flex>
              ) : filteredUsers.length === 0 ? (
                <Text color={textColor}>No users found</Text>
              ) : (
                filteredUsers.map(u => (
                  <Card key={u.id} bg={bgColor} border="1px solid" borderColor="#304945" w="100%">
                    {/* ... mobile card content unchanged ... */}
                  </Card>
                ))
              )}
            </VStack>
          )}
        </Box>
      </Card>

      {/* User Modals */}
      <Modal isOpen={isFormOpen} onClose={closeForm} title={selectedUser ? 'Edit User' : 'Add New User'}>
        <UserForm user={selectedUser} onSubmit={handleUserSubmit} onCancel={closeForm} />
      </Modal>
      <Modal isOpen={isDeleteOpen} onClose={closeDelete} title="Delete User">
        <Box>
          <Text mb={4}>Are you sure you want to delete {userToDelete?.username}? This cannot be undone.</Text>
          <HStack spacing={3} justify="flex-end">
            <Button variant="outline" onClick={closeDelete}>Cancel</Button>
            <Button colorScheme="red" onClick={handleDeleteConfirm}>Delete</Button>
          </HStack>
        </Box>
      </Modal>

      {/* Roles Modal (full width) */}
      <Modal isOpen={isRolesOpen} onClose={closeRoles} title="Manage Roles" size="full">
        <Box>
          <Box overflowX="auto">
            <Table>
              <Thead bg={headerBg}>
                <Tr>
                  <Th borderColor={borderColor}>Name</Th>
                  <Th borderColor={borderColor}>Permissions</Th>
                  <Th borderColor={borderColor}>Description</Th>
                  <Th borderColor={borderColor}>Created At</Th>
                  <Th borderColor={borderColor}>Updated At</Th>
                  <Th borderColor={borderColor}>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {roles.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} textAlign="center" py={8} borderColor={borderColor}>
                      No roles available
                    </Td>
                  </Tr>
                ) : (
                  roles.map(role => (
                    <Tr key={role.id}>
                      <Td borderColor={borderColor}>
                        <HStack spacing={3}>
                          <Box bg="vrv.100" p={2} rounded="lg" color="vrv.500">
                            <ShieldCheckIcon className="h-5 w-5" />
                          </Box>
                          <Badge colorScheme={getRoleBadgeColor(role.name)} px={2} py={1} rounded="full">
                            {role.name}
                          </Badge>
                        </HStack>
                      </Td>
                      <Td borderColor={borderColor}>
                        <HStack spacing={2} flexWrap="wrap">
                          {role.permissions.slice(0, 2).map(p => (
                            <Tag key={p} size="sm" variant="subtle" colorScheme="vrv">
                              <TagLabel>{p}</TagLabel>
                            </Tag>
                          ))}
                          {role.permissions.length > 2 && (
                            <Tooltip label={role.permissions.slice(2).join(', ')} hasArrow>
                              <Tag size="sm" variant="subtle" colorScheme="gray" cursor="pointer">
                                <TagLabel>+{role.permissions.length - 2} more</TagLabel>
                              </Tag>
                            </Tooltip>
                          )}
                        </HStack>
                      </Td>
                      <Td borderColor={borderColor}><Text color={textColor}>{role.description}</Text></Td>
                      <Td borderColor={borderColor}><Text fontSize="sm" color={textColor}>{formatDate(role.createdAt)}</Text></Td>
                      <Td borderColor={borderColor}><Text fontSize="sm" color={textColor}>{formatDate(role.updatedAt)}</Text></Td>
                      <Td borderColor={borderColor}>
                        <HStack spacing={2}>
                          <Tooltip label="Edit permissions" hasArrow>
                            <IconButton
                              icon={<KeyIcon className="h-4 w-4" />}
                              variant="ghost"
                              colorScheme="vrv"
                              size="sm"
                              onClick={() => handlePermissionsClick(role)}
                            />
                          </Tooltip>
                          <Tooltip label="Edit role" hasArrow>
                            <IconButton
                              icon={<PencilSquareIcon className="h-4 w-4" />}
                              variant="ghost"
                              colorScheme="vrv"
                              size="sm"
                              onClick={() => handleEditRole(role)}
                            />
                          </Tooltip>
                          <Tooltip label={role.name === 'Admin' ? "Cannot delete Admin" : "Delete role"} hasArrow>
                            <IconButton
                              icon={<TrashIcon className="h-4 w-4" />}
                              variant="ghost"
                              colorScheme="red"
                              size="sm"
                              onClick={() => handleDeleteRoleClick(role)}
                              isDisabled={role.name === 'Admin'}
                            />
                          </Tooltip>
                        </HStack>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Box>
          <Button leftIcon={<PlusIcon className="h-5 w-5" />} onClick={handleAddRole} mt={4}>
            Add Role
          </Button>
        </Box>
      </Modal>

      {/* Role Form & Permissions Modals */}
      <Modal isOpen={isRoleFormOpen} onClose={closeRoleForm} title={selectedRole ? 'Edit Role' : 'Add New Role'}>
        <RoleForm role={selectedRole} onSubmit={handleRoleSubmit} onCancel={closeRoleForm} />
      </Modal>
      <Modal isOpen={isPermissionsOpen} onClose={closePermissions} title={`Manage Permissions – ${selectedRole?.name}`}>
        <RolePermissions role={selectedRole} onSave={handlePermissionsSubmit} onCancel={closePermissions} />
      </Modal>
      <Modal isOpen={isRoleDeleteOpen} onClose={closeRoleDelete} title="Delete Role">
        <Box>
          <Text mb={4}>Are you sure you want to delete the {roleToDelete?.name} role?</Text>
          <HStack spacing={3} justify="flex-end">
            <Button variant="outline" onClick={closeRoleDelete}>Cancel</Button>
            <Button colorScheme="red" onClick={handleRoleDeleteConfirm}>Delete</Button>
          </HStack>
        </Box>
      </Modal>
    </Box>
  );
}

export default Users;
