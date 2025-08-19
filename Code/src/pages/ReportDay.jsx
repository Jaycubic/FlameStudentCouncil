import { useState, useEffect } from 'react';
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
  HStack,
  ButtonGroup,
  Button,
} from '@chakra-ui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { reportService } from '../services/reportService';
import { format } from 'date-fns';

// Define the CSS for the editing row
const editingRowStyle = `
  .editing-row {
    background-color: #f0f9ff;
    transform: translateY(-2px);
    transition: all 0.2s ease-in-out;
  }
`;

// Inject the CSS into the document
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = editingRowStyle;
document.head.appendChild(styleSheet);

function ReportDay() {
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', batch: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({ Reported: 0, AccompanyWith: null });

  const toast = useToast();
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.batch]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { students, total } = await reportService.getReportData(currentPage, filters);
        setStudents(students);
        setTotalCount(total);
        setTotalPages(Math.ceil(total / 100));

        if (batches.length === 0) {
          const batchesData = await reportService.getBatches();
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
  }, [currentPage, filters.search, filters.batch]);

  const handleEditClick = (student) => {
    setEditingId(student.id);
    setEditValues({ Reported: student.Reported, AccompanyWith: student.AccompanyWith });
  };

  const handleSaveClick = async (student) => {
    try {
      await reportService.updateReportData(student.id, editValues);
      const updatedStudents = students.map(s =>
        s.id === student.id ? { ...s, ...editValues } : s
      );
      setStudents(updatedStudents);
      setEditingId(null);
      toast({
        title: 'Success',
        description: 'Report data updated successfully',
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

  const formatDate = date => {
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch {
      return 'N/A';
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
                Report Day
              </Text>
              <Text color={textColor} fontSize="sm">
                Manage student report data
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
              placeholder="Filter by Batch"
              value={filters.batch}
              onChange={e => setFilters({ ...filters, batch: e.target.value })}
              maxW={{ md: '200px' }}
            >
              <option value="">All Batches</option>
              {batches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </Select>
          </Stack>

          <Text color={textColor} fontSize="sm" mb={4}>
            Showing {students.length} of {totalCount} students
          </Text>
        </Box>

        <Box overflowX="auto" maxHeight="calc(100vh - 300px)" position="relative">
          <Table>
            <Thead position="sticky" top={0} zIndex={1}>
              <Tr bg={gradientBg}>
                <Th color="white" borderColor="white">Student ID</Th>
                <Th color="white" borderColor="white">Student Info</Th>
                <Th color="white" borderColor="white">Batch</Th>
                <Th color="white" borderColor="white">DOB</Th>
                <Th color="white" borderColor="white">Home Town</Th>
                <Th color="white" borderColor="white">Reported</Th>
                <Th color="white" borderColor="white">Accompany With</Th>
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
                  <Tr key={student.id} className={editingId === student.id ? 'editing-row' : ''}>
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
                        {student.HomeTown || 'N/A'}
                      </Text>
                    </Td>
                    <Td borderColor={borderColor}>
                      {editingId === student.id ? (
                        <Select
                          value={editValues.Reported}
                          onChange={e => setEditValues({ ...editValues, Reported: parseInt(e.target.value) })}
                        >
                          <option value={0}>NO</option>
                          <option value={1}>YES</option>
                        </Select>
                      ) : (
                        <Text>{student.Reported === 1 ? 'YES' : 'NO'}</Text>
                      )}
                    </Td>
                    <Td borderColor={borderColor}>
                      {editingId === student.id ? (
                        <Input
                          type="number"
                          value={editValues.AccompanyWith || ''}
                          onChange={e => setEditValues({ ...editValues, AccompanyWith: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="N/A"
                        />
                      ) : (
                        <Text>{student.AccompanyWith !== null ? student.AccompanyWith : 'N/A'}</Text>
                      )}
                    </Td>
                    <Td borderColor={borderColor}>
                      {editingId === student.id ? (
                        <IconButton
                          icon={<CheckIcon className="h-5 w-5" />}
                          variant="solid"
                          colorScheme="green"
                          size="lg"
                          borderRadius="full"
                          boxShadow="md"
                          onClick={() => handleSaveClick(student)}
                        />
                      ) : (
                        <IconButton
                          icon={<PencilSquareIcon className="h-5 w-5" />}
                          variant="solid"
                          colorScheme="blue"
                          size="lg"
                          borderRadius="full"
                          boxShadow="md"
                          onClick={() => handleEditClick(student)}
                        />
                      )}
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
      </Card>
    </Box>
  );
}

export default ReportDay;
