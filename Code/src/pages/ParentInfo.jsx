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
  Spinner,
  Tooltip,
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
} from '@chakra-ui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import ParentInfoService from '../services/ParentInfoService';

function ParentInfo() {
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [editForm, setEditForm] = useState({
    id: '',
    FatherName: '',
    FatherEmailID: '',
    FatherMobileNo: '',
    MotherName: '',
    MotherEmailID: '',
    MotherMobileNo: ''
  });
  const [filters, setFilters] = useState({ search: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
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
          ParentInfoService.getParentDetails(currentPage, filters),
          ParentInfoService.getTotalCount(filters),
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

  const handleEditClick = (student) => {
    setSelectedStudent(student);
    setEditForm({
      id: student.id,
      FatherName: student.FatherName || '',
      FatherEmailID: student.FatherEmailID || '',
      FatherMobileNo: student.FatherMobileNo || '',
      MotherName: student.MotherName || '',
      MotherEmailID: student.MotherEmailID || '',
      MotherMobileNo: student.MotherMobileNo || ''
    });
    onOpen();
  };

  const handleSubmit = async () => {
    try {
      await ParentInfoService.updateStudent(selectedStudent.id, editForm);
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
                Parent Info
              </Text>
              <Text color={textColor} fontSize="sm">
                Manage student parent records
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
                    <Th color="white" borderColor="white">Father Info</Th>
                    <Th color="white" borderColor="white">Father Mobile</Th>
                    <Th color="white" borderColor="white">Mother Info</Th>
                    <Th color="white" borderColor="white">Mother Mobile</Th>
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
                          <VStack align="start" spacing={1}>
                            <Text fontWeight="medium">{student.FatherName || 'N/A'}</Text>
                            <Text fontSize="sm" color={textColor}>{student.FatherEmailID || 'N/A'}</Text>
                          </VStack>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.FatherMobileNo || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <VStack align="start" spacing={1}>
                            <Text fontWeight="medium">{student.MotherName || 'N/A'}</Text>
                            <Text fontSize="sm" color={textColor}>{student.MotherEmailID || 'N/A'}</Text>
                          </VStack>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.MotherMobileNo || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Tooltip label="Edit student" hasArrow>
                            <IconButton
                              icon={<PencilSquareIcon className="h-4 w-4" />}
                              variant="ghost"
                              colorScheme="blue"
                              size="sm"
                              onClick={() => handleEditClick(student)}
                            />
                          </Tooltip>
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
                      <Text fontSize="sm">Father Name: {student.FatherName || 'N/A'}</Text>
                      <Text fontSize="sm">Father Email: {student.FatherEmailID || 'N/A'}</Text>
                      <Text fontSize="sm">Father Mobile: {student.FatherMobileNo || 'N/A'}</Text>
                      <Text fontSize="sm">Mother Name: {student.MotherName || 'N/A'}</Text>
                      <Text fontSize="sm">Mother Email: {student.MotherEmailID || 'N/A'}</Text>
                      <Text fontSize="sm">Mother Mobile: {student.MotherMobileNo || 'N/A'}</Text>
                      <IconButton
                        icon={<PencilSquareIcon className="h-4 w-4" />}
                        variant="outline"
                        colorScheme="blue"
                        size="sm"
                        onClick={() => handleEditClick(student)}
                      />
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
          <ModalHeader>Edit Parent Information</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedStudent && (
              <VStack spacing={4}>
                <Text fontWeight="bold">{selectedStudent.StudentName} ({selectedStudent.EmailID})</Text>
                <FormControl>
                  <FormLabel>Father Name</FormLabel>
                  <Input
                    value={editForm.FatherName}
                    onChange={e => setEditForm({ ...editForm, FatherName: e.target.value })}
                    placeholder="Enter Father Name"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Father Email</FormLabel>
                  <Input
                    value={editForm.FatherEmailID}
                    onChange={e => setEditForm({ ...editForm, FatherEmailID: e.target.value })}
                    placeholder="Enter Father Email"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Father Mobile</FormLabel>
                  <Input
                    value={editForm.FatherMobileNo}
                    onChange={e => setEditForm({ ...editForm, FatherMobileNo: e.target.value })}
                    placeholder="Enter Father Mobile"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Mother Name</FormLabel>
                  <Input
                    value={editForm.MotherName}
                    onChange={e => setEditForm({ ...editForm, MotherName: e.target.value })}
                    placeholder="Enter Mother Name"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Mother Email</FormLabel>
                  <Input
                    value={editForm.MotherEmailID}
                    onChange={e => setEditForm({ ...editForm, MotherEmailID: e.target.value })}
                    placeholder="Enter Mother Email"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Mother Mobile</FormLabel>
                  <Input
                    value={editForm.MotherMobileNo}
                    onChange={e => setEditForm({ ...editForm, MotherMobileNo: e.target.value })}
                    placeholder="Enter Mother Mobile"
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
    </Box>
  );
}

export default ParentInfo;
