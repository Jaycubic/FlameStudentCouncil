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
  Button,
  Image,
  Icon,
  Checkbox,
} from '@chakra-ui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  UserIcon,
  CameraIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import studentInfoService from '../services/studentInfoService';
import idCardService from '../services/idCardService';
import { format } from 'date-fns';

function StudentInfoTable() {
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', batch: '', gender: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState(null);
  const [photoError, setPhotoError] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [completedStudents, setCompletedStudents] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfPath, setPdfPath] = useState(null);

  const toast = useToast();
  const fileInputRef = useRef(null);

  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

  // Load completed students from local storage
  useEffect(() => {
    const completed = JSON.parse(localStorage.getItem('completedStudents')) || [];
    setCompletedStudents(completed);
  }, []);

  // Fetch data with all filters
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [studentsData, total] = await Promise.all([
          studentInfoService.getStudents(currentPage, filters),
          studentInfoService.getTotalCount(filters),
        ]);

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

  // Handle student selection
  const handleSelectStudent = (studentCvueNo) => {
    setSelectedStudents(prev =>
      prev.includes(studentCvueNo)
        ? prev.filter(id => id !== studentCvueNo)
        : [...prev, studentCvueNo]
    );
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedStudents.length === students.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map(s => s.StudentCvueNo).filter(id => id != null));
    }
  };

  // Handle select first 5
  const handleSelectFirstFive = () => {
    const firstFiveIds = students.slice(0, 5).map(s => s.StudentCvueNo).filter(id => id != null);
    if (selectedStudents.length === firstFiveIds.length && firstFiveIds.every(id => selectedStudents.includes(id))) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(firstFiveIds);
    }
  };

  // Handle PDF generation
  const handleGeneratePDF = async () => {
    if (selectedStudents.length === 0) {
      toast({
        title: 'Error',
        description: 'No students selected',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    // Filter out null or invalid IDs
    const validStudentIds = selectedStudents.filter(id => id != null && !isNaN(parseInt(id, 10)));
    if (validStudentIds.length === 0) {
      toast({
        title: 'Error',
        description: 'No valid student IDs selected',
        status: 'error',
        duration: 3000,
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await idCardService.generatePDF(validStudentIds);
      setPdfPath(response.path);
      toast({
        title: 'PDF Generated',
        description: 'The student ID cards have been generated successfully',
        status: 'success',
        duration: 3000,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle PDF preview/download
  const handlePreviewPDF = () => {
    if (pdfPath) {
      window.open(`${pdfPath}`, '_blank');
    }
  };

  const handleDownloadPDF = () => {
    if (pdfPath) {
      const link = document.createElement('a');
      link.href = `${pdfPath}`;
      link.download = 'student_ids.pdf';
      link.click();
    }
  };

  // Handle mark complete
  const handleMarkComplete = () => {
    const newCompleted = [...new Set([...completedStudents, ...selectedStudents])];
    localStorage.setItem('completedStudents', JSON.stringify(newCompleted));
    setCompletedStudents(newCompleted);
    setSelectedStudents([]);
    setPdfPath(null); // Reset PDF path after marking complete
    toast({
      title: 'Marked as Complete',
      description: `${selectedStudents.length} students marked as complete`,
      status: 'success',
      duration: 2000,
    });
  };

  // Modal handlers
  const handleModalOpen = async (student) => {
    setModalStudent(student);
    setPhotoError(false);
    setPhotoUrl(null);
    try {
      if (student.Photo) {
        const url = await studentInfoService.getStudentPhoto(student.Photo);
        setPhotoUrl(url);
      }
    } catch (error) {
      setPhotoError(true);
    }
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setModalStudent(null);
    setPhotoError(false);
    setPhotoUrl(null);
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.size > 1024 * 1024) {
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

  const triggerFileInput = () => fileInputRef.current.click();

  const formatDate = date => {
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch {
      return 'N/A';
    }
  };

  return (
    <Box p={8}>
      {isGenerating && (
        <Modal isOpen={isGenerating} isCentered closeOnOverlayClick={false}>
          <ModalOverlay bg="rgba(0, 0, 0, 0.6)" />
          <ModalContent bg="transparent" boxShadow="none">
            <ModalBody textAlign="center">
              <Spinner size="xl" color="white" />
              <Text color="white" mt={4}>Generating IDs, please wait...</Text>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}
      <Card variant="outline" bg={bgColor} overflow="hidden">
        <Box px={6} py={4}>
          <Flex justify="space-between" align="center" mb={4}>
            <Box>
              <Text fontSize="2xl" fontWeight="bold" color="gray.700">
                Student Information
              </Text>
              <Text color={textColor} fontSize="sm">
                Manage student records and generate ID cards
              </Text>
            </Box>
            <HStack>
              <Button
                colorScheme="blue"
                onClick={handleGeneratePDF}
                isDisabled={selectedStudents.length === 0}
              >
                Generate PDF
              </Button>
              {pdfPath && (
                <>
                  <Button colorScheme="teal" onClick={handlePreviewPDF}>
                    Preview
                  </Button>
                  <IconButton
                    icon={<ArrowDownTrayIcon className="h-5 w-5" />}
                    colorScheme="green"
                    onClick={handleDownloadPDF}
                    aria-label="Download PDF"
                  />
                </>
              )}
              <Button
                colorScheme="green"
                onClick={handleMarkComplete}
                isDisabled={selectedStudents.length === 0}
              >
                Mark Complete
              </Button>
            </HStack>
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

          <Box overflowX="auto" maxHeight="calc(100vh - 300px)">
            <Table>
              <Thead position="sticky" top={0} zIndex={1}>
                <Tr bg={gradientBg}>
                  <Th color="white" borderColor="white">
                    <HStack spacing={2}>
                      <Checkbox
                        isChecked={selectedStudents.length === students.length && students.length > 0}
                        onChange={handleSelectAll}
                      />
                      <Button size="xs" onClick={handleSelectAll} colorScheme="whiteAlpha">
                        All
                      </Button>
                      <Button size="xs" onClick={handleSelectFirstFive} colorScheme="whiteAlpha">
                        First 5
                      </Button>
                    </HStack>
                  </Th>
                  <Th color="white" borderColor="white">Student ID</Th>
                  <Th color="white" borderColor="white">Student Info</Th>
                  <Th color="white" borderColor="white">Batch</Th>
                  <Th color="white" borderColor="white">DOB</Th>
                  <Th color="white" borderColor="white">Blood Group</Th>
                  <Th color="white" borderColor="white">Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {isLoading ? (
                  <Tr>
                    <Td colSpan={7} textAlign="center" py={8} borderColor={borderColor}>
                      <Spinner size="sm" mr={2} /> Loading...
                    </Td>
                  </Tr>
                ) : students.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} textAlign="center" py={8} borderColor={borderColor}>
                      No students found
                    </Td>
                  </Tr>
                ) : (
                  students.map(student => (
                    <Tr
                      key={student.StudentCvueNo || student.id}
                      _hover={{ bg: 'gray.50' }}
                      bg={completedStudents.includes(student.StudentCvueNo) ? 'green.50' : 'inherit'}
                    >
                      <Td borderColor={borderColor}>
                        <Checkbox
                          isChecked={selectedStudents.includes(student.StudentCvueNo)}
                          onChange={() => handleSelectStudent(student.StudentCvueNo)}
                          isDisabled={student.StudentCvueNo == null}
                        />
                      </Td>
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
                        <Text fontSize="sm" color={textColor}>{student.Batch || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{formatDate(student.DOB)}</Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{student.BloodGroup || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <Tooltip label="View details" hasArrow>
                          <IconButton
                            icon={<UserIcon className="h-4 w-4" />}
                            variant="ghost"
                            colorScheme="green"
                            size="sm"
                            onClick={() => handleModalOpen(student)}
                          />
                        </Tooltip>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </Box>

          <Flex justify="space-between" mt={4}>
            <Button
              leftIcon={<ChevronLeftIcon className="h-5 w-5" />}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              isDisabled={currentPage === 1}
            >
              Previous
            </Button>
            <Text>Page {currentPage} of {totalPages}</Text>
            <Button
              rightIcon={<ChevronRightIcon className="h-5 w-5" />}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              isDisabled={currentPage === totalPages}
            >
              Next
            </Button>
          </Flex>
        </Box>
      </Card>

      {/* Student Details Modal */}
      <Modal isOpen={isModalOpen} onClose={handleModalClose}>
        <ModalOverlay />
        <ModalContent maxWidth="450px">
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
                <VStack align="start" spacing={2}>
                  <Text fontWeight="bold" color="teal.500">{modalStudent.StudentName}</Text>
                  <Text color={textColor}>Student ID: {modalStudent.StudentCvueNo || 'N/A'}</Text>
                  <Text color={textColor}>DOB: {formatDate(modalStudent.DOB)}</Text>
                  <Text color={textColor}>Batch: {modalStudent.Batch}</Text>
                  <Text color={textColor}>Blood Group: {modalStudent.BloodGroup || 'N/A'}</Text>
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
