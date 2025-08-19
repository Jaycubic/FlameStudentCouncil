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
  SimpleGrid,
  Icon,
} from '@chakra-ui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { studentStatusService } from '../services/studentStatusService';

// StatCard component similar to Dashboard
function StatCard({ title, stat, icon, color }) {
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue(color, color);
  return (
    <Card bg={bgColor} border="1px solid" borderColor="#304945">
      <Box p={4}>
        <HStack spacing={4}>
          <Box p={3} bg="gray.100" borderRadius="lg">
            <Icon as={icon} boxSize={6} color={color} />
          </Box>
          <Box flex={1}>
            <Text fontSize="sm" color={textColor}>{title}</Text>
            <Text fontSize="2xl" fontWeight="bold" color={textColor}>{stat}</Text>
          </Box>
        </HStack>
      </Box>
    </Card>
  );
}

function StudentStatusTracking() {
  const [students, setStudents] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    ACTIVE: 0,
    LOA: 0,
    'STUDY ABROAD': 0,
    'WITHDRAWAL COMPLETED': 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    StudentStatus: '',
    WithDrawnDate: '',
    WithDrawnReason: '',
    WithDrawnComment: '',
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    search: '',
    studentStatus: '',
  });
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const displayMode = useBreakpointValue({ base: 'mobile', md: 'desktop' });
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

  // Colors similar to dashboard
  const COLORS = {
    active: '#2563eb', // Blue
    loa: '#f97316', // Orange
    studyAbroad: '#10b981', // Green
    withdrawn: '#ef4444', // Red
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [studentsData, counts] = await Promise.all([
          studentStatusService.getStudentStatusData(currentPage, filters),
          studentStatusService.getStudentStatusCounts(),
        ]);
        setStudents(studentsData);
        setStatusCounts(counts);
        setTotalPages(Math.ceil(1000 / 100)); // Adjust as needed
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

  const handleEditClick = (student) => {
    setSelectedStudent(student);
    setEditForm({
      StudentStatus: student.StudentStatus || '',
      WithDrawnDate: student.WithDrawnDate || '',
      WithDrawnReason: student.WithDrawnReason || '',
      WithDrawnComment: student.WithDrawnComment || '',
    });
    onOpen();
  };

  const handleSubmit = async () => {
    if (!editForm.StudentStatus) {
      toast({
        title: 'Error',
        description: 'Please select a status to proceed',
        status: 'error',
        duration: 3000,
      });
      return;
    }
    try {
      const updateData = { StudentStatus: editForm.StudentStatus };
      if (editForm.StudentStatus === 'WITHDRAWAL COMPLETED') {
        updateData.WithDrawnDate = editForm.WithDrawnDate;
        updateData.WithDrawnReason = editForm.WithDrawnReason;
        updateData.WithDrawnComment = editForm.WithDrawnComment;
      }
      await studentStatusService.updateStudent(selectedStudent.StudentCvueNo, updateData);
      const updatedStudents = students.map(s =>
        s.StudentCvueNo === selectedStudent.StudentCvueNo ? { ...s, ...updateData } : s
      );
      setStudents(updatedStudents);
      const counts = await studentStatusService.getStudentStatusCounts();
      setStatusCounts(counts);
      onClose();
      toast({
        title: 'Success',
        description: 'Student status updated successfully',
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
                Student Status Tracking
              </Text>
              <Text color={textColor} fontSize="sm">
                Manage student status records
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

          {/* Statistics Cards */}
          <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={6} mb={6}>
            <StatCard
              title="Active Students"
              stat={statusCounts.ACTIVE}
              icon={UserGroupIcon}
              color={COLORS.active}
            />
            <StatCard
              title="LOA Students"
              stat={statusCounts.LOA}
              icon={UserGroupIcon}
              color={COLORS.loa}
            />
            <StatCard
              title="Study Abroad Students"
              stat={statusCounts['STUDY ABROAD']}
              icon={UserGroupIcon}
              color={COLORS.studyAbroad}
            />
            <StatCard
              title="Withdrawn Students"
              stat={statusCounts['WITHDRAWAL COMPLETED']}
              icon={UserGroupIcon}
              color={COLORS.withdrawn}
            />
          </SimpleGrid>

          <Stack direction={{ base: 'column', md: 'row' }} spacing={4} mb={6}>
            <InputGroup maxW={{ md: '300px' }}>
              <InputLeftElement pointerEvents="none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray.400" />
              </InputLeftElement>
              <Input
                placeholder="Search by name or CVUE No..."
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
              />
            </InputGroup>
            <Select
              placeholder="Filter by Student Status"
              value={filters.studentStatus}
              onChange={e => setFilters({ ...filters, studentStatus: e.target.value })}
              maxW={{ md: '200px' }}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="LOA">LOA</option>
              <option value="STUDY ABROAD">STUDY ABROAD</option>
              <option value="WITHDRAWAL IN PROGRESS">WITHDRAWAL IN PROGRESS</option>
              <option value="WITHDRAWAL COMPLETED">WITHDRAWAL COMPLETED</option>
            </Select>
          </Stack>

          <Text color={textColor} fontSize="sm" mb={4}>
            Showing {students.length} students
          </Text>
        </Box>

        <Box>
          {displayMode === 'desktop' ? (
            <Box overflowX="auto" maxHeight="calc(100vh - 300px)" position="relative">
              <Table>
                <Thead position="sticky" top={0} zIndex={1}>
                  <Tr bg={gradientBg}>
                    <Th color="white" borderColor="white">Student Details</Th>
                    <Th color="white" borderColor="white">Housing Details</Th>
                    <Th color="white" borderColor="white">Status</Th>
                    <Th color="white" borderColor="white">Student Status</Th>
                    <Th color="white" borderColor="white">Withdrawn Date</Th>
                    <Th color="white" borderColor="white">Withdrawn Reason</Th>
                    <Th color="white" borderColor="white">Withdrawn Comment</Th>
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
                      <Tr key={student.StudentCvueNo} _hover={{ bg: 'gray.50' }}>
                        <Td borderColor={borderColor}>
                          <VStack align="start" spacing={1}>
                            <Text fontFamily="mono" fontSize="sm" color={textColor}>
                              ID: {student.StudentCvueNo || 'N/A'}
                            </Text>
                            <Text fontSize="sm" color={textColor}>{student.StudentName || 'N/A'}</Text>
                            <Text fontSize="sm" color={textColor}>{student.EmailID || 'N/A'}</Text>
                          </VStack>
                        </Td>
                        <Td borderColor={borderColor}>
                          <VStack align="start" spacing={1}>
                            <Text fontSize="sm" color={textColor}>RC: {student.RCName || 'N/A'}</Text>
                            <Text fontSize="sm" color={textColor}>Block: {student.HousingBlock || 'N/A'}</Text>
                            <Text fontSize="sm" color={textColor}>House: {student.House || 'N/A'}</Text>
                          </VStack>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.Status || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.StudentStatus || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>
                            {student.WithDrawnDate ? new Date(student.WithDrawnDate).toLocaleDateString() : 'N/A'}
                          </Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.WithDrawnReason || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.WithDrawnComment || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <HStack spacing={2}>
                            <Tooltip label="Edit status" hasArrow>
                              <IconButton
                                icon={<PencilSquareIcon className="h-4 w-4" />}
                                variant="ghost"
                                colorScheme="blue"
                                size="sm"
                                onClick={() => handleEditClick(student)}
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
                  <Card key={student.StudentCvueNo} bg={bgColor} w="100%" p={4}>
                    <VStack align="start" spacing={2}>
                      <Text fontWeight="bold" fontFamily="mono">ID: {student.StudentCvueNo || 'N/A'}</Text>
                      <Text>Name: {student.StudentName || 'N/A'}</Text>
                      <Text>Email: {student.EmailID || 'N/A'}</Text>
                      <Text>RC: {student.RCName || 'N/A'}</Text>
                      <Text>House: {student.House || 'N/A'}</Text>
                      <Text>Block: {student.HousingBlock || 'N/A'}</Text>
                      <Text>Status: {student.Status || 'N/A'}</Text>
                      <Text>Student Status: {student.StudentStatus || 'N/A'}</Text>
                      <Text>Withdrawn Date: {student.WithDrawnDate ? new Date(student.WithDrawnDate).toLocaleDateString() : 'N/A'}</Text>
                      <Text>Withdrawn Reason: {student.WithDrawnReason || 'N/A'}</Text>
                      <Text>Withdrawn Comment: {student.WithDrawnComment || 'N/A'}</Text>
                      <HStack spacing={2}>
                        <IconButton
                          icon={<PencilSquareIcon className="h-4 w-4" />}
                          variant="outline"
                          colorScheme="blue"
                          size="sm"
                          onClick={() => handleEditClick(student)}
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
          <ModalHeader>Edit Student Status</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedStudent && (
              <VStack spacing={4}>
                <Text fontWeight="bold">{selectedStudent.StudentName}</Text>
                <Text>Student CVUE No: {selectedStudent.StudentCvueNo}</Text>
                <Text>Status: {selectedStudent.Status}</Text>
                <FormControl>
                  <FormLabel>Student Status</FormLabel>
                  <Select
                    value={editForm.StudentStatus}
                    onChange={e => setEditForm({ ...editForm, StudentStatus: e.target.value })}
                  >
                    <option value="">Select Status</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="LOA">LOA</option>
                    <option value="STUDY ABROAD">STUDY ABROAD</option>
                    <option value="WITHDRAWAL IN PROGRESS">WITHDRAWAL IN PROGRESS</option>
                    <option value="WITHDRAWAL COMPLETED">WITHDRAWAL COMPLETED</option>
                  </Select>
                </FormControl>
                {editForm.StudentStatus === 'WITHDRAWAL COMPLETED' && (
                  <>
                    <FormControl>
                      <FormLabel>Withdrawn Date</FormLabel>
                      <Input
                        type="date"
                        value={editForm.WithDrawnDate ? new Date(editForm.WithDrawnDate).toISOString().split('T')[0] : ''}
                        onChange={e => setEditForm({ ...editForm, WithDrawnDate: e.target.value })}
                      />
                    </FormControl>
                    <FormControl>
                      <FormLabel>Withdrawn Reason</FormLabel>
                      <Select
                        value={editForm.WithDrawnReason}
                        onChange={e => setEditForm({ ...editForm, WithDrawnReason: e.target.value })}
                      >
                        <option value="Personal">Personal</option>
                        <option value="Academic">Academic</option>
                        <option value="Admission to Indian Institute">Admission to Indian Institute</option>
                        <option value="Admission to International Institute">Admission to International Institute</option>
                        <option value="Disciplinary Action">Disciplinary Action</option>
                        <option value="Infrastructure">Infrastructure</option>
                        <option value="Medical">Medical</option>
                        <option value="Non Academic">Non Academic</option>
                      </Select>
                    </FormControl>
                    <FormControl>
                      <FormLabel>Withdrawn Comment</FormLabel>
                      <Input
                        value={editForm.WithDrawnComment}
                        onChange={e => setEditForm({ ...editForm, WithDrawnComment: e.target.value })}
                        placeholder="Enter comment"
                      />
                    </FormControl>
                  </>
                )}
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
    </Box>
  );
}

export default StudentStatusTracking;
