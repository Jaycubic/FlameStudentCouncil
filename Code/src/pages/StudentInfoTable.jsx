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
  Image,
  Icon,
} from '@chakra-ui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  UserIcon,
  CameraIcon,
} from '@heroicons/react/24/outline';
import studentInfoService from '../services/studentInfoService';
import { format } from 'date-fns';

function StudentInfoTable() {
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editForm, setEditForm] = useState({ id: '', HomeTown: '', ContactNo: '' });
  const [filters, setFilters] = useState({ search: '', batch: '', gender: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState(null);
  const [photoError, setPhotoError] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const displayMode = useBreakpointValue({ base: 'mobile', md: 'desktop' });
  const fileInputRef = useRef(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.batch, filters.gender]);

  // Fetch data with all filters
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [studentsData, total] = await Promise.all([
          studentInfoService.getStudents(currentPage, filters),
          studentInfoService.getTotalCount(filters),
        ]);
        console.log('Fetched students data:', studentsData); // Debug log
        setStudents(studentsData);
        setTotalCount(total);
        setTotalPages(Math.ceil(total / 100));

        // Fetch batches only once
        if (batches.length === 0) {
          const batchesData = await studentInfoService.getBatches();
          setBatches(batchesData);
        }
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
  }, [currentPage, filters.search, filters.batch, filters.gender]);

  // Handle edit click
  const handleEditClick = (student) => {
    console.log('Selected student:', student); // Debug log
    setSelectedStudent(student);
    setEditForm({
      id: student.id || '',
      HomeTown: student.HomeTown || '',
      ContactNo: student.ContactNo || ''
    });
    onOpen();
  };

  // Handle form submit
  const handleSubmit = async () => {
    console.log('Submitting update for student ID:', selectedStudent?.id, 'with data:', editForm); // Debug log
    try {
      if (!selectedStudent?.id || isNaN(selectedStudent.id)) {
        throw new Error('Invalid or missing student ID');
      }
      await studentInfoService.updateStudent(selectedStudent.id, editForm);
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
      console.error('Update error:', error);
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    }
  };

  // Handle modal open
  const handleModalOpen = async (student) => {
    setModalStudent(student);
    setPhotoError(false);
    setPhotoUrl(null);
    try {
      if (student.Photo) {
        const url = await studentInfoService.getStudentPhoto(student.Photo);
        setPhotoUrl(url);
      } else {
        toast({
          title: 'Info',
          description: 'No Photo Available',
          status: 'info',
          duration: 3000,
        });
      }
    } catch (error) {
      setPhotoError(true);
      toast({
        title: 'Info',
        description: 'No Photo Available',
        status: 'info',
        duration: 3000,
      });
    }
    setIsModalOpen(true);
  };

  // Handle modal close
  const handleModalClose = () => {
    setIsModalOpen(false);
    setModalStudent(null);
    setPhotoError(false);
    setPhotoUrl(null);
  };

  // Handle photo upload
  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Image size should be less than 1MB',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    try {
      await studentInfoService.uploadStudentPhoto(modalStudent.Photo, file);
      const newPhotoUrl = await studentInfoService.getStudentPhoto(modalStudent.Photo);
      setPhotoUrl(newPhotoUrl);
      setPhotoError(false);
      toast({
        title: 'Success',
        description: 'Photo uploaded successfully',
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

  // Trigger file input click
  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Format date
  const formatDate = date => {
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch {
      return 'N/A';
    }
  };

  // Pagination handlers
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
                Student Information
              </Text>
              <Text color={textColor} fontSize="sm">
                Manage student records and information
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

          {/* Filters */}
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
              placeholder="Filter by Batch"
              value={filters.batch}
              onChange={e => setFilters({ ...filters, batch: e.target.value })}
              maxW={{ md: '200px' }}
            >
              {batches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </Select>

            <Select
              placeholder="Filter by Gender"
              value={filters.gender}
              onChange={e => setFilters({ ...filters, gender: e.target.value })}
              maxW={{ md: '200px' }}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </Select>
          </Stack>

          <Text color={textColor} fontSize="sm" mb={4}>
            Showing {students.length} of {totalCount} students
          </Text>
        </Box>

        {/* Students Table */}
        <Box>
          {displayMode === 'desktop' ? (
            <Box overflowX="auto" maxHeight="calc(100vh - 300px)" position="relative">
              <Table>
                <Thead position="sticky" top={0} zIndex={1}>
                  <Tr bg={gradientBg}>
                    <Th color="white" borderColor="white">Student ID</Th>
                    <Th color="white" borderColor="white">Student Info</Th>
                    <Th color="white" borderColor="white">Batch</Th>
                    <Th color="white" borderColor="white">DOB</Th>
                    <Th color="white" borderColor="white">House</Th>
                    <Th color="white" borderColor="white">Home Town</Th>
                    <Th color="white" borderColor="white">Contact No</Th>
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
                            <Text fontWeight="medium">{student.StudentName}</Text>
                            <HStack spacing={2}>
                              <Text fontSize="sm" color="teal.500">{student.Gender || 'N/A'}</Text>
                              <Text>-</Text>
                              <Text fontSize="sm" color={textColor}>{student.EmailID}</Text>
                            </HStack>
                          </VStack>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>
                            {student.Batch || 'N/A'}
                          </Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>
                            {formatDate(student.DOB)}
                          </Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>
                            {student.House || 'N/A'}
                          </Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>
                            {student.HomeTown || 'N/A'}
                          </Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>
                            {student.ContactNo || 'N/A'}
                          </Text>
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
                            <Tooltip label="View details" hasArrow>
                              <IconButton
                                icon={<UserIcon className="h-4 w-4" />}
                                variant="ghost"
                                colorScheme="green"
                                size="sm"
                                onClick={() => handleModalOpen(student)}
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
                <Flex direction="center" align="center" py={8}>
                  <Spinner size="sm" mr={2} /><Text>Loading...</Text>
                </Flex>
              ) : students.length === 0 ? (
                <Text color={textColor}>No students found</Text>
              ) : (
                students.map(student => (
                  <Card key={student.id} bg={bgColor} w="100%" p={4}>
                    <VStack align="start" spacing={2}>
                      <Text fontWeight="bold">ID: {student.StudentCvueNo}</Text>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="medium">{student.StudentName}</Text>
                        <HStack spacing={2}>
                          <Text fontSize="sm" color="teal.500">{student.Gender || 'N/A'}</Text>
                          <Text>-</Text>
                          <Text fontSize="sm" color={textColor}>{student.EmailID}</Text>
                        </HStack>
                      </VStack>
                      <HStack spacing={4}>
                        <Text fontSize="sm">Batch: {student.Batch}</Text>
                      </HStack>
                      <Text fontSize="sm">DOB: {formatDate(student.DOB)}</Text>
                      <Text fontSize="sm">House: {student.House || 'N/A'}</Text>
                      <Text fontSize="sm">Home Town: {student.HomeTown || 'N/A'}</Text>
                      <Text fontSize="sm">Contact: {student.ContactNo || 'N/A'}</Text>
                      <HStack spacing={2}>
                        <IconButton
                          icon={<PencilSquareIcon className="h-4 w-4" />}
                          variant="outline"
                          colorScheme="blue"
                          size="sm"
                          onClick={() => handleEditClick(student)}
                        />
                        <IconButton
                          icon={<UserIcon className="h-4 w-4" />}
                          variant="outline"
                          colorScheme="green"
                          size="sm"
                          onClick={() => handleModalOpen(student)}
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

      {/* Edit Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Student Information</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedStudent && (
              <VStack spacing={4}>
                <Text fontWeight="bold">{selectedStudent.StudentName}</Text>

                <FormControl>
                  <FormLabel>Home Town</FormLabel>
                  <Input
                    value={editForm.HomeTown}
                    onChange={e => setEditForm({ ...editForm, HomeTown: e.target.value })}
                    placeholder="Enter home town"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Contact Number</FormLabel>
                  <Input
                    value={editForm.ContactNo}
                    onChange={e => setEditForm({ ...editForm, ContactNo: e.target.value })}
                    placeholder="Enter contact number"
                  />
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

      {/* Student Details Modal */}
      <Modal isOpen={isModalOpen} onClose={handleModalClose}>
        <ModalOverlay />
        <ModalContent maxWidth="500px">
          <ModalHeader bg={gradientBg} color="white" borderTopRadius="md">
            Student Details
          </ModalHeader>
          <ModalCloseButton color="white" />
          <ModalBody>
            {modalStudent && (
              <Flex direction={{ base: 'column', md: 'row' }} align="center">
                <Box flexShrink={0} mb={{ base: 4, md: 0 }} mr={{ md: 4 }} mt={{ md: 2 }}>
                  {photoUrl && !photoError ? (
                    <Image
                      src={photoUrl}
                      alt="Student Photo"
                      boxSize="150px"
                      objectFit="cover"
                      borderRadius="md"
                      onError={() => setPhotoError(true)}
                    />
                  ) : (
                    <Box boxSize="150px" display="flex" alignItems="center" justifyContent="center" bg="gray.100" borderRadius="md">
                      <Icon as={UserIcon} w={16} h={16} color="gray.400" />
                    </Box>
                  )}
                  <IconButton
                    icon={<CameraIcon className="h-4 w-4" />}
                    onClick={triggerFileInput}
                    aria-label="Upload photo"
                    mt={2}
                  />
                  <Input
                    type="file"
                    accept=".jpg,.jpeg"
                    ref={fileInputRef}
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </Box>
                <VStack align="start" spacing={3}>
                  <Text fontWeight="bold" fontSize="lg" color="teal.500">{modalStudent.StudentName || 'N/A'}</Text>
                  <Text color={textColor}>Student ID: {modalStudent.StudentCvueNo || 'N/A'}</Text>
                  <Text color={textColor}>Email: {modalStudent.EmailID || 'N/A'}</Text>
                  <Text color={textColor}>Contact: {modalStudent.ContactNo || 'N/A'}</Text>
                  <Text color={textColor}>DOB: {formatDate(modalStudent.DOB)}</Text>
                  <Text color={textColor}>Batch: {modalStudent.Batch || 'N/A'}</Text>
                  <Text fontWeight="semibold" mt={4} color="gray.700">Father's Details</Text>
                  <Text color={textColor}>Name: {modalStudent.FatherName || 'N/A'}</Text>
                  <Text color={textColor}>Email: {modalStudent.FatherEmailID || 'N/A'}</Text>
                  <Text color={textColor}>Mobile: {modalStudent.FatherMobileNo || 'N/A'}</Text>
                  <Text fontWeight="semibold" mt={4} color="gray.700">Mother's Details</Text>
                  <Text color={textColor}>Name: {modalStudent.MotherName || 'N/A'}</Text>
                  <Text color={textColor}>Email: {modalStudent.MotherEmailID || 'N/A'}</Text>
                  <Text color={textColor}>Mobile: {modalStudent.MotherMobileNo || 'N/A'}</Text>
                </VStack>
              </Flex>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" onClick={handleModalClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default StudentInfoTable;
