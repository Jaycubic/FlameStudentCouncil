import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import {
  Box,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  VStack,
  Flex,
  Text,
  Card,
  useToast,
  Input,
  InputGroup,
  InputLeftElement,
  Stack,
  Select,
  Spinner,
  HStack,
  ButtonGroup,
  Button,
  IconButton,
} from '@chakra-ui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { queueCountService } from '../services/QueueCountService';

function ReportDayDashboard() {
  const [locations, setLocations] = useState([]);
  const [queueCounts, setQueueCounts] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [queueList, setQueueList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({ search: '', department: '', date: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [reportedSummaryData, setReportedSummaryData] = useState(null);
  const [reportedList, setReportedList] = useState([]);
  const [reportedTotalCount, setReportedTotalCount] = useState(0);
  const [reportedCurrentPage, setReportedCurrentPage] = useState(1);
  const [reportedTotalPages, setReportedTotalPages] = useState(1);
  const [selectedTab, setSelectedTab] = useState('summary');
  const [summaryDate, setSummaryDate] = useState('');
  const toast = useToast();
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [locationsData, countsData, summaryData] = await Promise.all([
          queueCountService.getLocations(),
          queueCountService.getQueueCounts(),
          queueCountService.getSummaryTableData(summaryDate),
        ]);
        setLocations(locationsData);
        setQueueCounts(countsData);
        setSummaryData(summaryData);
        setSelectedLocation(null);
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
  }, [summaryDate]);

  useEffect(() => {
    if (selectedTab === 'location' && selectedLocation) {
      fetchQueueList();
    }
  }, [selectedLocation, currentPage, filters.department, filters.date]);

  useEffect(() => {
    if (selectedTab === 'studentReported') {
      fetchReportedList();
    }
  }, [reportedCurrentPage, filters.department]);

  useEffect(() => {
    const socket = io('https://flamestudentcouncil.in:5050', {
      withCredentials: true,
      query: { token: localStorage.getItem('token') },
    });
    socket.on('queueCountsUpdated', (data) => {
      setQueueCounts(data);
    });
    socket.on('queueListUpdated', (data) => {
      if (
        selectedLocation &&
        data.locationName === selectedLocation.locationName &&
        data.DeviceId === selectedLocation.DeviceId
      ) {
        setQueueList(data.data.data);
        setTotalCount(data.data.total);
        setTotalPages(data.data.totalPages);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [selectedLocation]);

  const fetchQueueList = async () => {
    if (!selectedLocation) {
      console.warn('selectedLocation is null');
      return;
    }
    setIsLoading(true);
    try {
      const { locationName, DeviceId } = selectedLocation;
      const data = await queueCountService.getQueueList(locationName, DeviceId, filters.department, currentPage, 100, filters.date);
      if (data.message) {
        setQueueList([]);
        setTotalCount(0);
        setTotalPages(0);
        toast({
          title: data.message,
          status: 'info',
          duration: 3000,
        });
      } else {
        setQueueList(data.data);
        setTotalCount(data.total);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      toast({
        title: 'Error loading queue list',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReportedSummary = async () => {
    try {
      const data = await queueCountService.getReportedStudentsSummary();
      setReportedSummaryData(data);
    } catch (error) {
      toast({
        title: 'Error loading reported summary',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    }
  };

  const fetchReportedList = async () => {
    setIsLoading(true);
    try {
      const data = await queueCountService.getReportedStudentsList(reportedCurrentPage, 100, filters.department);
      setReportedList(data.data);
      setReportedTotalCount(data.total);
      setReportedTotalPages(data.totalPages);
    } catch (error) {
      toast({
        title: 'Error loading reported list',
        description: error.message,
        status: 'error',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (index) => {
    if (index === 0) {
      setSelectedTab('summary');
      setSelectedLocation(null);
    } else if (index === 1) {
      setSelectedTab('studentReported');
      setSelectedLocation(null);
      fetchReportedSummary();
      fetchReportedList();
    } else {
      setSelectedTab('location');
      setSelectedLocation(locations[index - 2]);
      setCurrentPage(1);
      fetchQueueList();
    }
  };

  const goToPreviousPage = () => {
    if (selectedTab === 'studentReported') {
      if (reportedCurrentPage > 1) setReportedCurrentPage(reportedCurrentPage - 1);
    } else {
      if (currentPage > 1) setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (selectedTab === 'studentReported') {
      if (reportedCurrentPage < reportedTotalPages) setReportedCurrentPage(reportedCurrentPage + 1);
    } else {
      if (currentPage < totalPages) setCurrentPage(currentPage - 1);
    }
  };

  return (
    <Box p={8}>
      <Card variant="outline" bg="white" overflow="hidden">
        <Box px={6} py={4}>
          <Text fontSize="2xl" fontWeight="bold" color="gray.700">
            Report Day Dashboard
          </Text>
          <Text color="gray.600" fontSize="sm">
            Manage and view Reporting information by location
          </Text>
        </Box>
        <Tabs onChange={handleTabChange}>
          <TabList overflowX="auto" whiteSpace="nowrap">
            <Tab _selected={{ bg: gradientBg, color: 'white' }}>Summary</Tab>
            <Tab _selected={{ bg: gradientBg, color: 'white' }}>Student Reported</Tab>
            {locations.map((location, index) => (
              <Tab key={index} _selected={{ bg: gradientBg, color: 'white' }}>
                {location.locationName} - Device {location.DeviceId}
              </Tab>
            ))}
          </TabList>
          <TabPanels>
            {/* Summary Tab */}
            <TabPanel>
              {summaryData ? (
                summaryData.departments.length > 0 ? (
                  <VStack spacing={4}>
                    <Flex justify="space-between" w="full" align="center">
                      <Text fontSize="lg" fontWeight="bold">Overall Summary</Text>
                      <Input
                        type="date"
                        value={summaryDate}
                        onChange={e => setSummaryDate(e.target.value)}
                        maxW="200px"
                      />
                    </Flex>
                    <Box overflowX="auto">
                      <Table>
                        <Thead bg={gradientBg}>
                          <Tr>
                            <Th color="white" textAlign="center">Batch</Th>
                            {summaryData.locations.map(loc => (
                              <Th key={loc} color="white" textAlign="center">{loc}</Th>
                            ))}
                          </Tr>
                        </Thead>
                        <Tbody>
                          {summaryData.departments.map(dept => (
                            <Tr key={dept}>
                              <Td textAlign="center">{dept}</Td>
                              {summaryData.locations.map(loc => (
                                <Td key={loc} textAlign="center">{summaryData.data[dept][loc]}</Td>
                              ))}
                            </Tr>
                          ))}
                          <Tr>
                            <Td textAlign="center"><strong>Total</strong></Td>
                            {summaryData.locations.map(loc => (
                              <Td key={loc} textAlign="center"><strong>{summaryData.totals[loc]}</strong></Td>
                            ))}
                          </Tr>
                        </Tbody>
                      </Table>
                    </Box>
                  </VStack>
                ) : (
                  <Text>No data available</Text>
                )
              ) : (
                <Text>Loading summary data...</Text>
              )}
            </TabPanel>
            {/* Student Reported Tab */}
            <TabPanel>
              <VStack spacing={4}>
                <Text fontSize="lg" fontWeight="bold">Reported Students Summary</Text>
                {reportedSummaryData ? (
                  reportedSummaryData.length > 0 ? (
                    <Table>
                      <Thead bg={gradientBg}>
                        <Tr>
                          <Th color="white">Batch</Th>
                          <Th color="white">Count</Th>
                          <Th color="white">Total Accompanied</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {reportedSummaryData.map((item, index) => (
                          <Tr key={index}>
                            <Td>{item.Batch}</Td>
                            <Td>{item.count}</Td>
                            <Td>{item.totalAccompanied}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  ) : (
                    <Text>No reported students</Text>
                  )
                ) : (
                  <Text>Loading summary...</Text>
                )}
                {/* Filters */}
                <Stack direction={{ base: 'column', md: 'row' }} spacing={4} mb={6}>
                  <InputGroup maxW={{ md: '300px' }}>
                    <InputLeftElement pointerEvents="none">
                      <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </InputLeftElement>
                    <Input
                      placeholder={selectedTab === 'studentReported' ? "Search students..." : "Search employees..."}
                      value={filters.search}
                      onChange={e => setFilters({ ...filters, search: e.target.value })}
                    />
                  </InputGroup>
                  <Select
                    placeholder={selectedTab === 'studentReported' ? "Filter by Batch" : "Filter by Department"}
                    value={filters.department}
                    onChange={e => setFilters({ ...filters, department: e.target.value })}
                    maxW={{ md: '200px' }}
                  >
                    {selectedTab === 'studentReported' && reportedSummaryData ? (
                      reportedSummaryData.map(item => (
                        <option key={item.Batch} value={item.Batch}>{item.Batch}</option>
                      ))
                    ) : (
                      selectedTab === 'location' && selectedLocation && queueCounts.find(loc => loc.locationName === selectedLocation.locationName && loc.DeviceId === selectedLocation.DeviceId)?.departments &&
                      Object.keys(queueCounts.find(loc => loc.locationName === selectedLocation.locationName && loc.DeviceId === selectedLocation.DeviceId).departments).map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))
                    )}
                  </Select>
                </Stack>
                {/* Reported List Table */}
                <Box w="full" overflowX="auto">
                  <Table>
                    <Thead bg={gradientBg}>
                      <Tr>
                        <Th color="white">Student ID</Th>
                        <Th color="white">Student Name</Th>
                        <Th color="white">Gender</Th>
                        <Th color="white">Batch</Th>
                        <Th color="white">Accompanied With</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {isLoading ? (
                        <Tr>
                          <Td colSpan={5} textAlign="center" py={8}>
                            <Spinner size="sm" mr={2} /> Loading...
                          </Td>
                        </Tr>
                      ) : reportedList.length === 0 ? (
                        <Tr>
                          <Td colSpan={5} textAlign="center" py={8}>
                            No students found
                          </Td>
                        </Tr>
                      ) : (
                        reportedList.map((student, index) => (
                          <Tr key={index}>
                            <Td>{student.StudentCvueNo}</Td>
                            <Td>{student.StudentName}</Td>
                            <Td>{student.Gender}</Td>
                            <Td>{student.Batch}</Td>
                            <Td>{student.AccompanyWith}</Td>
                          </Tr>
                        ))
                      )}
                    </Tbody>
                  </Table>
                </Box>
                {/* Pagination */}
                <Flex justify="space-between" align="center" mt={4}>
                  <Text color="gray.600" fontSize="sm">
                    Showing {reportedList.length} of {reportedTotalCount} students
                  </Text>
                  <ButtonGroup isAttached>
                    <IconButton
                      icon={<ChevronLeftIcon className="h-5 w-5" />}
                      onClick={goToPreviousPage}
                      isDisabled={reportedCurrentPage === 1}
                      aria-label="Previous page"
                    />
                    <Button minWidth="100px">
                      Page {reportedCurrentPage} of {reportedTotalPages}
                    </Button>
                    <IconButton
                      icon={<ChevronRightIcon className="h-5 w-5" />}
                      onClick={goToNextPage}
                      isDisabled={reportedCurrentPage === reportedTotalPages}
                      aria-label="Next page"
                    />
                  </ButtonGroup>
                </Flex>
              </VStack>
            </TabPanel>
            {/* Location Tabs */}
            {locations.map((location, index) => (
              <TabPanel key={index}>
                <VStack spacing={4}>
                  <Flex justify="space-between" w="full" align="center">
                    {/* Filters on the left */}
                    <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
                      <InputGroup maxW={{ md: '300px' }}>
                        <InputLeftElement pointerEvents="none">
                          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                        </InputLeftElement>
                        <Input
                          placeholder="Search employees..."
                          value={filters.search}
                          onChange={e => setFilters({ ...filters, search: e.target.value })}
                        />
                      </InputGroup>
                      <Select
                        placeholder="Filter by Department"
                        value={filters.department}
                        onChange={e => setFilters({ ...filters, department: e.target.value })}
                        maxW={{ md: '200px' }}
                      >
                        {selectedTab === 'location' && selectedLocation && queueCounts.find(loc => loc.locationName === selectedLocation.locationName && loc.DeviceId === selectedLocation.DeviceId)?.departments &&
                          Object.keys(queueCounts.find(loc => loc.locationName === selectedLocation.locationName && loc.DeviceId === selectedLocation.DeviceId).departments).map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))
                        }
                      </Select>
                      <Input
                        type="date"
                        value={filters.date}
                        onChange={e => setFilters({ ...filters, date: e.target.value })}
                        maxW="200px"
                      />
                    </Stack>
                    {/* Title on the right */}
                    <Text fontSize="lg" fontWeight="bold">
                      {location.locationName} - Device {location.DeviceId}
                    </Text>
                  </Flex>
                  {/* Queue List Table */}
                  <Box w="full" overflowX="auto">
                    <Table>
                      <Thead bg={gradientBg}>
                        <Tr>
                          <Th color="white">Student ID</Th>
                          <Th color="white">Student Name</Th>
                          <Th color="white">Gender</Th>
                          <Th color="white">Batch</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {isLoading ? (
                          <Tr>
                            <Td colSpan={4} textAlign="center" py={8}>
                              <Spinner size="sm" mr={2} /> Loading...
                            </Td>
                          </Tr>
                        ) : queueList.length === 0 ? (
                          <Tr>
                            <Td colSpan={4} textAlign="center" py={8}>
                              No employees found
                            </Td>
                          </Tr>
                        ) : (
                          queueList.map((employee, empIndex) => (
                            <Tr key={empIndex}>
                              <Td>{employee.EmployeeId}</Td>
                              <Td>{employee.EmployeeName}</Td>
                              <Td>{employee.Gender}</Td>
                              <Td>{employee.Department}</Td>
                            </Tr>
                          ))
                        )}
                      </Tbody>
                    </Table>
                  </Box>
                  {/* Pagination */}
                  <Flex justify="space-between" align="center" mt={4}>
                    <Text color="gray.600" fontSize="sm">
                      Showing {queueList.length} of {totalCount} employees
                    </Text>
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
                </VStack>
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      </Card>
    </Box>
  );
}

export default ReportDayDashboard;
