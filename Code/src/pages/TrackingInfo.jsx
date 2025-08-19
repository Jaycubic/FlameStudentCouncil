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
  useBreakpointValue,
  ButtonGroup,
  Button,
} from '@chakra-ui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import TrackingInfoService from '../services/TrackingInfoService';

function TrackingInfo() {
  const [students, setStudents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', inout: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const toast = useToast();
  const displayMode = useBreakpointValue({ base: 'mobile', md: 'desktop' });

  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

  const getInOutBgColor = (inout, noOfDays) => {
    const days = noOfDays != null ? Number(noOfDays) : null;
    if (inout === 'OUT') {
      return 'orange.100';
    } else if (inout === 'IN' && days != null) {
      if (days === 0) {
        return 'green.100';
      } else if (days >= 1 && days <= 2) {
        return 'yellow.100';
      } else if (days >= 3 && days <= 5) {
        return 'orange.100';
      } else if (days > 5) {
        return 'red.100';
      }
    }
    return 'inherit';
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [studentsData, total] = await Promise.all([
          TrackingInfoService.getTrackingDetails(currentPage, filters),
          TrackingInfoService.getTotalCount(filters),
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
                Tracking Info
              </Text>
              <Text color={textColor} fontSize="sm">
                Manage student tracking records
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
                    <Th color="white" borderColor="white">IN/OUT</Th>
                    <Th color="white" borderColor="white">No of Days</Th>
                    <Th color="white" borderColor="white">Device Name</Th>
                    <Th color="white" borderColor="white">Last Punch Date</Th>
                    <Th color="white" borderColor="white">Device ID</Th>
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
                        <Td borderColor={borderColor} bg={getInOutBgColor(student.INOUT, student.NoOfDays)}>
                          <Text fontSize="sm" color={textColor}>{student.INOUT || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.NoOfDays != null ? student.NoOfDays : 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.DeviceName || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.LastPunchDate || 'N/A'}</Text>
                        </Td>
                        <Td borderColor={borderColor}>
                          <Text fontSize="sm" color={textColor}>{student.DeviceId || 'N/A'}</Text>
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
                      <Box bg={getInOutBgColor(student.INOUT, student.NoOfDays)} p={1} borderRadius="md">
                        <Text fontSize="sm" color={textColor}>IN/OUT: {student.INOUT || 'N/A'}</Text>
                      </Box>
                      <Text fontSize="sm">Days: {student.NoOfDays != null ? student.NoOfDays : 'N/A'}</Text>
                      <Text fontSize="sm">Device: {student.DeviceName || 'N/A'}</Text>
                      <Text fontSize="sm">Last Punch: {student.LastPunchDate || 'N/A'}</Text>
                      <Text fontSize="sm">Device ID: {student.DeviceId || 'N/A'}</Text>
                    </VStack>
                  </Card>
                ))
              )}
            </VStack>
          )}
        </Box>
      </Card>
    </Box>
  );
}

export default TrackingInfo;
