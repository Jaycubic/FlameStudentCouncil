import { useState, useEffect, useRef } from 'react';

import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
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
  Spinner,
  Tooltip,
  HStack,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  useBreakpointValue,
  ButtonGroup,
  Button,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
} from '@chakra-ui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import studentHouseTrackingService from '../services/studentHouseTrackingService';
import { userService } from '../services/userService';
import { authService } from '../services/authService';

function StudentHouseTracking() {
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [rcNames, setRcNames] = useState([]);
  const [editRcNames, setEditRcNames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editForm, setEditForm] = useState({ RCName: '', HousingBlock: '', Status: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteStudentId, setDeleteStudentId] = useState(null);

  const currentUser = authService.getCurrentUser();
  const isRC = currentUser && currentUser.role === 'RC';
  const userRcName = isRC ? currentUser.username : null;

  const [filters, setFilters] = useState({
    search: '',
    rcName: isRC ? userRcName : '',
    inout: ''
  });

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const cancelRef = useRef();
  const displayMode = useBreakpointValue({ base: 'mobile', md: 'desktop' });

  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [studentsData, total] = await Promise.all([
          studentHouseTrackingService.getHousingDetails(currentPage, filters),
          studentHouseTrackingService.getTotalCount(filters),
        ]);
        setStudents(studentsData);
        setTotalCount(total);
        setTotalPages(Math.ceil(total / 100));
      } catch (error) {
        toast({
          title: 'Error loading data',
          description: error.message,
          status: 'error',
          duration: 3000,
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentPage, filters]);

  useEffect(() => {
    const fetchRcNames = async () => {
      try {
        const rcNamesData = await studentHouseTrackingService.getRCNames();
        setRcNames(rcNamesData);
      } catch (error) {
        toast({
          title: 'Error loading RC names',
          description: error.message,
          status: 'error',
          duration: 3000,
        });
      }
    };
    fetchRcNames();
  }, []);

  useEffect(() => {
    const fetchEditRcNames = async () => {
      try {
        const rcNamesData = await userService.getRCUsernames();
        setEditRcNames(rcNamesData);
      } catch (error) {
        toast({
          title: 'Error loading RC names for edit',
          description: error.message,
          status: 'error',
          duration: 3000,
        });
      }
    };
    fetchEditRcNames();
  }, []);

  const handleEditClick = (student) => {
    setSelectedStudent(student);
    setEditForm({
      RCName: student.RCName || '',
      HousingBlock: student.HousingBlock || '',
      Status: student.Status || ''
    });
    onOpen();
  };

  const handleSubmit = async () => {
    try {
      await studentHouseTrackingService.updateStudent(selectedStudent.id, editForm);
      const updatedStudents = students.map(s =>
        s.id === selectedStudent.id ? { ...s, ...editForm } : s
      );
      setStudents(updatedStudents);
      onClose();
      toast({
        title: 'Success',
        description: 'Student updated successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    }
  };

  const handleDelete = async () => {
    try {
      await studentHouseTrackingService.deleteStudent(deleteStudentId);
      const [studentsData, total] = await Promise.all([
        studentHouseTrackingService.getHousingDetails(currentPage, filters),
        studentHouseTrackingService.getTotalCount(filters),
      ]);
      setStudents(studentsData);
      setTotalCount(total);
      setTotalPages(Math.ceil(total / 100));
      onDeleteClose();
      toast({
        title: 'Success',
        description: 'Student deleted successfully',
        status: 'success',
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  return (
    <Box p={8}>
      <Card variant="outline" bg={bgColor} overflow="hidden">
        <Box px={6} py={4}>
          <Flex justify="space-between" align="center" mb={4}>
            <Box>
              <Text fontSize="2xl" fontWeight="bold" color="gray.700">
                Student House Tracking
              </Text>
              <Text color={textColor} fontSize="sm">
                Manage student housing records
              </Text>
            </Box>
            <ButtonGroup isAttached>
              <IconButton
                icon={<ChevronLeftIcon className="h-5 w-5" />}
                onClick={goToPreviousPage}
                isDisabled={currentPage === 1}
                aria-label="Previous page"
              />
              <Button minWidth="100px">
                Page {currentPage} of {totalPages}
              </Button>
              <IconButton
                icon={<ChevronRightIcon className="h-5 w-5" />}
                onClick={goToNextPage}
                isDisabled={currentPage === totalPages}
                aria-label="Next page"
              />
            </ButtonGroup>
          </Flex>
          <Stack direction={{ base: 'column', md: 'row' }} spacing={4} mb={6}>
            <InputGroup maxW={{ md: '300px' }}>
              <InputLeftElement pointerEvents="none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search students..."
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
              />
            </InputGroup>
            <Select
              placeholder="Filter by RC Name"
              value={filters.rcName}
              onChange={e => setFilters({ ...filters, rcName: e.target.value })}
              maxW={{ md: '200px' }}
              isDisabled={isRC}
            >
              {rcNames.map(rcName => (
                <option key={rcName} value={rcName}>{rcName}</option>
              ))}
            </Select>
            <Select
              placeholder="Filter by IN/OUT"
              value={filters.inout}
              onChange={e => setFilters({ ...filters, inout: e.target.value })}
              maxW={{ md: '200px' }}
            >
              <option value="IN">IN</option>
              <option value="OUT">OUT</option>
            </Select>
          </Stack>
          <Text color={textColor} fontSize="sm" mb={4}>
            Showing {students.length} of {totalCount} students
          </Text>
        </Box>
        <Box>
          {displayMode === 'desktop' ? (
            <Box overflowX="auto" maxHeight="calc(100vh - 300px)" position="relative">
              <Table>
                <Thead position="sticky" top={0} zIndex={1}>
                  <Tr bg={gradientBg}>
                    <Th color="white" borderColor="white">Student ID</Th>
                    <Th color="white" borderColor="white">Student Info</Th>
                    <Th color="white" borderColor="white">RC Name</Th>
                    <Th color="white" borderColor="white">Housing Block</Th>
                    <Th color="white" borderColor="white">Status</Th>
                    <Th color="white" borderColor="white">No of Days</Th>
                    <Th color="white" borderColor="white">IN/OUT</Th>
                    <Th color="white" borderColor="white">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {isLoading ? (
                    <Tr>
                      <Td colSpan={8} textAlign="center" py={8} borderColor={borderColor}>
                        <Spinner size="sm" mr={2} /> Loading...
                      </Td>
                    </Tr>
                  ) : students.length === 0 ? (
                    <Tr>
                      <Td colSpan={8} textAlign="center" py={8} borderColor={borderColor}>
                        No students found
                      </Td>
                    </Tr>
                  ) : (
                    students.map(student => (
                      <Tr key={student.id} _hover={{ bg: 'gray.50' }}>
                        <Td borderColor={borderColor}>
                          <Text fontFamily="mono" fontSize="sm" color={textColor}>
                            {student.StudentCvueNo || 'N/A'}
                          </Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <VStack align="start" spacing={1}>
                            <Text fontWeight="medium">{student.StudentName || 'N/A'}</Text>
                            <Text fontSize="sm" color={textColor}>{student.EmailID || 'N/A'}</Text>
                          </VStack>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.RCName || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.HousingBlock || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.Status || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.NoOfDays || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor} bg={student.INOUT === 'OUT' ? 'orange.100' : 'inherit'}>
                          <Text fontSize="sm" color={textColor}>{student.INOUT || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <HStack spacing={2}>
                            <Tooltip label="Edit student" hasArrow>
                              <IconButton
                                icon={<PencilSquareIcon className="h-4 w-4" />}
                                variant="ghost"
                                colorScheme="blue"
                                size="sm"
                                onClick={() => handleEditClick(student)}
                              />
                            </Tooltip>
                            <Tooltip label="Delete student" hasArrow>
                              <IconButton
                                icon={<TrashIcon className="h-4 w-4" />}
                                variant="ghost"
                                colorScheme="red"
                                size="sm"
                                onClick={() => {
                                  setDeleteStudentId(student.id);
                                  onDeleteOpen();
                                }}
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
              ) : students.length === 0 ? (
                <Text color={textColor}>No students found</Text>
              ) : (
                students.map(student => (
                  <Card key={student.id} bg={bgColor} w="100%" p={4}>
                    <VStack align="start" spacing={2}>
                      <Text fontWeight="bold" fontFamily="mono">ID: {student.StudentCvueNo || 'N/A'}</Text>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="medium">{student.StudentName || 'N/A'}</Text>
                        <Text fontSize="sm" color={textColor}>{student.EmailID || 'N/A'}</Text>
                      </VStack>
                      <Text fontSize="sm">RC: {student.RCName || 'N/A'}</Text>
                      <Text fontSize="sm">Block: {student.HousingBlock || 'N/A'}</Text>
                      <Text fontSize="sm">Status: {student.Status || 'N/A'}</Text>
                      <Text fontSize="sm">Days: {student.NoOfDays || 'N/A'}</Text>
                      <Text fontSize="sm" bg={student.INOUT === 'OUT' ? 'orange.100' : 'inherit'}>
                        IN/OUT: {student.INOUT || 'N/A'}
                      </Text>
                      <HStack spacing={2}>
                        <IconButton
                          icon={<PencilSquareIcon className="h-4 w-4" />}
                          variant="outline"
                          colorScheme="blue"
                          size="sm"
                          onClick={() => handleEditClick(student)}
                        />
                        <IconButton
                          icon={<TrashIcon className="h-4 w-4" />}
                          variant="outline"
                          colorScheme="red"
                          size="sm"
                          onClick={() => {
                            setDeleteStudentId(student.id);
                            onDeleteOpen();
                          }}
                        />
                      </HStack>
                    </VStack>
                  </Card>
                ))
              )}
            </VStack>
          )}
        </Box>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Student Housing Information</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedStudent && (
              <VStack spacing={4}>
                <Text fontWeight="bold">{selectedStudent.StudentName}</Text>
                <FormControl>
                  <FormLabel>RC Name</FormLabel>
                  <Select
                    value={editForm.RCName}
                    onChange={e => setEditForm({ ...editForm, RCName: e.target.value })}
                    placeholder="Select RC Name"
                  >
                    {editRcNames.map(rcName => (
                      <option key={rcName} value={rcName}>{rcName}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Housing Block</FormLabel>
                  <Input
                    value={editForm.HousingBlock}
                    onChange={e => setEditForm({ ...editForm, HousingBlock: e.target.value })}
                    placeholder="Enter Housing Block"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={editForm.Status}
                    onChange={e => setEditForm({ ...editForm, Status: e.target.value })}
                    placeholder="Select Status"
                  >
                    <option value="Housing">Housing</option>
                    <option value="Housing Not Required">Housing Not Required</option>
                  </Select>
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSubmit}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <AlertDialog
        isOpen={isDeleteOpen}
        leastDestructiveRef={cancelRef}
        onClose={onDeleteClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Student
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete this student? This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onDeleteClose}>
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleDelete} ml={3}>
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

export default StudentHouseTracking;
