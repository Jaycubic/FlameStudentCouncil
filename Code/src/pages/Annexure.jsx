// src/components/Annexure.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  IconButton,
  useDisclosure,
  Flex,
  Text,
  Card,
  useToast,
  useColorModeValue,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Stack,
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
  Button,
  ButtonGroup,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Portal,
  VStack,
  Checkbox,
  Skeleton,
  SkeletonText,
} from '@chakra-ui/react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilSquareIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  CloudArrowDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { TableVirtuoso } from 'react-virtuoso';
import { annexureService } from '../services/annexureService';

// Shimmer Animation
const Shimmer = () => (
  <Box
    position="absolute"
    top={0}
    left="-150%"
    height="100%"
    width="150%"
    background="linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)"
    animation="shimmer 2s infinite"
  />
);

const SkeletonRow = () => (
  <Tr>
    {[...Array(16)].map((_, i) => (
      <Td key={i} borderColor="gray.200">
        <Box position="relative" overflow="hidden" borderRadius="md">
          <Skeleton height="20px" />
          <Shimmer />
        </Box>
      </Td>
    ))}
  </Tr>
);

const SkeletonMobileCard = () => (
  <Card p={4} mb={4}>
    <VStack align="start" spacing={3}>
      <Skeleton height="16px" width="70%" />
      <Skeleton height="14px" width="60%" />
      <Skeleton height="14px" width="80%" />
      <Skeleton height="14px" width="50%" />
      <Skeleton height="32px" width="40px" borderRadius="full" />
    </VStack>
  </Card>
);

function Annexure() {
  const [annexureData, setAnnexureData] = useState({ data: [], total: 0, page: 1, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnnexure, setSelectedAnnexure] = useState(null);
  const [editForm, setEditForm] = useState({ code: '', academic_year: '', batch: '', semester: '', course_code: '', course_title: '', credits: '', capacity: '', year: '', attribute: '', category: '', short_name: '', department: '', area: '', course_type: '', sessions: '' });
  const [globalFilters, setGlobalFilters] = useState({ search: '' });
  const initialColumnFilters = {
    academic_year: [], batch: [], semester: [], course_code: [], course_title: [], credits: [], capacity: [], year: [], attribute: [], category: [], short_name: [], department: [], area: [], course_type: [], sessions: [],
  };
  const [columnFilters, setColumnFilters] = useState(initialColumnFilters);
  const [sortField, setSortField] = useState('');
  const [sortDir, setSortDir] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState({});
  const [searchInput, setSearchInput] = useState('');

  const toast = useToast();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const displayMode = useBreakpointValue({ base: 'mobile', md: 'desktop' });
  const bgColor = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
  const titleColor = useColorModeValue('gray.700', 'white');
  const hoverBg = useColorModeValue('gray.50', 'gray.700');

  const filterableColumns = ['academic_year', 'batch', 'semester', 'course_code', 'course_title', 'credits', 'capacity', 'year', 'attribute', 'category', 'short_name', 'department', 'area', 'course_type', 'sessions'];
  const hasFilters = Object.values(columnFilters).some(arr => arr.length > 0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilters(prev => ({ ...prev, search: searchInput }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [globalFilters, columnFilters, sortField, sortDir]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const filters = { ...globalFilters };
        for (const col in columnFilters) {
          if (columnFilters[col].length > 0) {
            filters[col] = columnFilters[col].join(',');
          }
        }
        const data = await annexureService.getAnnexure(currentPage, 100, filters, sortField, sortDir);
        setAnnexureData(data);
      } catch (error) {
        toast({
          title: 'Error loading data',
          description: error.message,
          status: 'error',
          duration: 3000,
        });
      } finally {
        setIsLoading(false);
        setLoadingFilters({});
      }
    };

    fetchData();
  }, [currentPage, globalFilters, columnFilters, sortField, sortDir]);

  const handleEditClick = (annexure) => {
    setSelectedAnnexure(annexure);
    setEditForm({
      code: annexure.code || '',
      academic_year: annexure.academic_year || '',
      batch: annexure.batch || '',
      semester: annexure.semester || '',
      course_code: annexure.course_code || '',
      course_title: annexure.course_title || '',
      credits: annexure.credits || '',
      capacity: annexure.capacity || '',
      year: annexure.year || '',
      attribute: annexure.attribute || '',
      category: annexure.category || '',
      short_name: annexure.short_name || '',
      department: annexure.department || '',
      area: annexure.area || '',
      course_type: annexure.course_type || '',
      sessions: annexure.sessions || '',
    });
    onOpen();
  };

  const handleSubmit = async () => {
    try {
      if (!selectedAnnexure?.id) throw new Error('Invalid annexure ID');
      const updated = await annexureService.updateAnnexure(selectedAnnexure.id, editForm);
      const updatedData = {
        ...annexureData,
        data: annexureData.data.map(s => s.id === selectedAnnexure.id ? { ...s, ...updated.annexure } : s)
      };
      setAnnexureData(updatedData);
      onClose();
      toast({ title: 'Success', description: 'Annexure updated successfully', status: 'success', duration: 2000 });
    } catch (error) {
      toast({ title: 'Error', description: error.message, status: 'error', duration: 3000 });
    }
  };

  const goToPreviousPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
  const goToNextPage = () => { if (currentPage < annexureData.pages) setCurrentPage(currentPage + 1); };

  const handleCheckboxChange = (column, val, isChecked) => {
    setLoadingFilters(prev => ({
      ...prev,
      [column]: { ...prev[column], [val || 'blank']: true }
    }));

    setColumnFilters(prev => {
      const current = [...(prev[column] || [])];
      if (isChecked) {
        if (!current.includes(val || '')) current.push(val || '');
      } else {
        const index = current.indexOf(val || '');
        if (index > -1) current.splice(index, 1);
      }
      return { ...prev, [column]: current };
    });
  };

  const handleSort = (column, dir) => {
    setSortField(column);
    setSortDir(dir);
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const result = await annexureService.importFromSheet();
      toast({ title: 'Success', description: result.message, status: 'success', duration: 3000 });
      const filters = { ...globalFilters };
      for (const col in columnFilters) {
        if (columnFilters[col].length > 0) filters[col] = columnFilters[col].join(',');
      }
      const data = await annexureService.getAnnexure(currentPage, 100, filters, sortField, sortDir);
      setAnnexureData(data);
    } catch (error) {
      toast({ title: 'Error', description: error.response?.data?.message || error.message, status: 'error', duration: 3000 });
    } finally {
      setIsImporting(false);
    }
  };

  const FilterPopoverContent = ({ column }) => {
    const [filterText, setFilterText] = useState('');
    const [filteredValues, setFilteredValues] = useState([]);
    const [blanksMatch, setBlanksMatch] = useState(true);

    useEffect(() => {
      const lcFilter = filterText.toLowerCase();
      setBlanksMatch(filterText === '' || '(blank)'.toLowerCase().includes(lcFilter));

      const timer = setTimeout(async () => {
        try {
          const vals = await annexureService.getUnique(column, filterText);
          const sorted = vals.sort((a, b) => ('' + a).localeCompare('' + b));
          setFilteredValues(sorted);
        } catch (error) {
          console.error(`Error fetching filtered unique for ${column}:`, error);
        }
      }, 300);

      return () => clearTimeout(timer);
    }, [filterText, column]);

    const handleSelectAll = () => {
      const loadObj = filteredValues.reduce((acc, val) => ({ ...acc, [val]: true }), {});
      if (blanksMatch) loadObj['blank'] = true;
      setLoadingFilters(prev => ({ ...prev, [column]: loadObj }));
      const fullFiltered = filteredValues.map(val => '' + val);
      if (blanksMatch) fullFiltered.push('');
      setColumnFilters(prev => ({ ...prev, [column]: fullFiltered }));
    };

    const handleClear = () => {
      const current = columnFilters[column] || [];
      const loadObj = current.reduce((acc, val) => ({ ...acc, [val || 'blank']: true }), {});
      setLoadingFilters(prev => ({ ...prev, [column]: loadObj }));
      setColumnFilters(prev => ({ ...prev, [column]: [] }));
    };

    return (
      <VStack align="stretch" spacing={2}>
        <Button size="sm" onClick={() => handleSort(column, 'asc')}>Sort A to Z</Button>
        <Button size="sm" onClick={() => handleSort(column, 'desc')}>Sort Z to A</Button>
        <Text fontSize="sm" fontWeight="bold">Filter by values</Text>
        <Input placeholder="Search" size="sm" value={filterText} onChange={e => setFilterText(e.target.value)} />
        <Flex justify="space-between" align="center">
          <Button variant="link" size="sm" onClick={handleSelectAll}>Select all</Button>
          <Button variant="link" size="sm" onClick={handleClear}>Clear</Button>
          <Text fontSize="sm">{filteredValues.length + (blanksMatch ? 1 : 0)}</Text>
        </Flex>
        <Box height="150px" overflowY="auto" border="1px solid" borderColor="gray.200" borderRadius="md" p={1}>
          {blanksMatch && (
            <Flex align="center" p={1}>
              <Checkbox isChecked={columnFilters[column]?.includes('')} onChange={e => handleCheckboxChange(column, '', e.target.checked)}>
                (Blanks)
              </Checkbox>
              {loadingFilters[column]?.['blank'] && <Spinner size="xs" ml="auto" />}
            </Flex>
          )}
          {filteredValues.map(val => (
            <Flex key={val} align="center" p={1}>
              <Checkbox isChecked={columnFilters[column]?.includes(val)} onChange={e => handleCheckboxChange(column, val, e.target.checked)}>
                {val}
              </Checkbox>
              {loadingFilters[column]?.[val] && <Spinner size="xs" ml="auto" />}
            </Flex>
          ))}
        </Box>
      </VStack>
    );
  };

  const renderFilterPopover = (column) => (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <IconButton icon={<FunnelIcon className="h-4 w-4" />} variant="ghost" size="sm" aria-label={`Filter ${column}`} />
      </PopoverTrigger>
      <Portal>
        <PopoverContent>
          <PopoverArrow />
          <PopoverBody>
            <FilterPopoverContent column={column} />
          </PopoverBody>
        </PopoverContent>
      </Portal>
    </Popover>
  );

  return (
    <Box p={[2, 4, 6]} pt={[1, 2, 3]}>
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-150%); }
          100% { transform: translateX(150%); }
        }
      `}</style>

      <Card variant="outline" bg={bgColor} overflow="hidden">
        <Box px={6} py={4}>
          {/* Header */}
          <Flex justify="space-between" align="center" mb={4}>
            <Box>
              {isLoading ? (
                <>
                  <Skeleton height="32px" width="280px" mb={2} />
                  <Skeleton height="20px" width="200px" />
                </>
              ) : (
                <>
                  <Text fontSize="2xl" fontWeight="bold" color={titleColor}>
                    Annexure Records
                  </Text>
                  <Text color={textColor} fontSize="sm">
                    Manage annexure records
                  </Text>
                </>
              )}
            </Box>

            <VStack align="flex-end" spacing={2}>
              <Tooltip label="Import from Sheet" hasArrow>
                <IconButton
                  icon={isImporting ? <Spinner size="sm" /> : <CloudArrowDownIcon className="h-5 w-5" />}
                  onClick={handleImport}
                  isDisabled={isImporting}
                  aria-label="Import from Sheet"
                />
              </Tooltip>
            </VStack>
          </Flex>

          {/* Controls */}
          <Flex justify="space-between" align="center" mb={4}>
            <HStack spacing={2}>
              <InputGroup maxW="300px">
                <InputLeftElement pointerEvents="none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray.400" />
                </InputLeftElement>
                {isLoading ? (
                  <Skeleton height="40px" flex="1" />
                ) : (
                  <Input
                    placeholder="Search annexure..."
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                  />
                )}
                {(!isLoading && searchInput !== globalFilters.search) && <InputRightElement><Spinner size="sm" /></InputRightElement>}
              </InputGroup>
              {hasFilters && !isLoading && (
                <Tooltip label="Clear all filters" hasArrow>
                  <IconButton
                    icon={<XMarkIcon className="h-5 w-5" />}
                    variant="ghost"
                    onClick={() => setColumnFilters(initialColumnFilters)}
                    aria-label="Clear all filters"
                  />
                </Tooltip>
              )}
            </HStack>
            {isLoading ? (
              <Skeleton height="40px" width="200px" borderRadius="md" />
            ) : (
              <ButtonGroup isAttached>
                <IconButton icon={<ChevronLeftIcon className="h-5 w-5" />} onClick={goToPreviousPage} isDisabled={currentPage === 1} />
                <Button minWidth="100px">Page {currentPage} of {annexureData.pages}</Button>
                <IconButton icon={<ChevronRightIcon className="h-5 w-5" />} onClick={goToNextPage} isDisabled={currentPage === annexureData.pages} />
              </ButtonGroup>
            )}
          </Flex>

          <Text color={textColor} fontSize="sm" mb={4}>
            {isLoading ? <Skeleton height="20px" width="180px" /> : `Showing ${annexureData.data.length} of ${annexureData.total} records`}
          </Text>
        </Box>

        {/* Table */}
        <Box>
          {displayMode === 'desktop' ? (
            <Box overflowX="auto">
              {isLoading ? (
                <Table>
                  <Thead>
                    <Tr bg={gradientBg}>
                      {[...Array(16)].map((_, i) => (
                        <Th key={i} color="white">
                          <Skeleton height="20px" width="80%" />
                        </Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {[...Array(8)].map((_, i) => (
                      <SkeletonRow key={i} />
                    ))}
                  </Tbody>
                </Table>
              ) : (
                <TableVirtuoso
                  data={annexureData.data || []}
                  style={{ height: 'calc(100vh - 300px)' }}
                  components={{
                    Table: ({ style, ...props }) => <Table {...props} style={{ ...style }} />,
                    TableHead: Thead,
                    TableRow: ({ item: record, ...props }) => <Tr {...props} _hover={{ bg: hoverBg }} />,
                    TableBody: React.forwardRef(({ ...props }, ref) => <Tbody {...props} ref={ref} />),
                    EmptyPlaceholder: () => (
                      <Tr>
                        <Td colSpan={16} textAlign="center" py={8} borderColor={borderColor}>
                          No records found
                        </Td>
                      </Tr>
                    ),
                  }}
                  fixedHeaderContent={() => (
                    <Tr bg={gradientBg}>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Academic Year</Text>
                          {renderFilterPopover('academic_year')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Batch</Text>
                          {renderFilterPopover('batch')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Semester</Text>
                          {renderFilterPopover('semester')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Course Code</Text>
                          {renderFilterPopover('course_code')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Course Title</Text>
                          {renderFilterPopover('course_title')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Credits</Text>
                          {renderFilterPopover('credits')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Capacity</Text>
                          {renderFilterPopover('capacity')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Year</Text>
                          {renderFilterPopover('year')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Attribute</Text>
                          {renderFilterPopover('attribute')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Category</Text>
                          {renderFilterPopover('category')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Short Name</Text>
                          {renderFilterPopover('short_name')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Department</Text>
                          {renderFilterPopover('department')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Area</Text>
                          {renderFilterPopover('area')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Course Type</Text>
                          {renderFilterPopover('course_type')}
                        </Flex>
                      </Th>
                      <Th color="white" borderRight="1px solid white" borderBottom="1px solid white">
                        <Flex justify="space-between" align="center">
                          <Text color="white">Sessions</Text>
                          {renderFilterPopover('sessions')}
                        </Flex>
                      </Th>
                      <Th color="white" borderBottom="1px solid white">Actions</Th>
                    </Tr>
                  )}
                  itemContent={(index, record) => (
                    <>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.academic_year || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.batch || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.semester || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.course_code || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.course_title || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.credits || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.capacity || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.year || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.attribute || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.category || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.short_name || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.department || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.area || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.course_type || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text fontSize="sm" color={textColor}>{record.sessions || 'N/A'}</Text>
                      </Td>
                      <Td borderColor={borderColor}>
                        <HStack spacing={2}>
                          <Tooltip label="Edit record" hasArrow>
                            <IconButton
                              icon={<PencilSquareIcon className="h-4 w-4" />}
                              variant="ghost"
                              colorScheme="blue"
                              size="sm"
                              onClick={() => handleEditClick(record)}
                            />
                          </Tooltip>
                        </HStack>
                      </Td>
                    </>
                  )}
                />
              )}
            </Box>
          ) : (
            <Stack spacing={4} px={4} py={2}>
              {isLoading ? (
                [...Array(6)].map((_, i) => <SkeletonMobileCard key={i} />)
              ) : annexureData.data.length === 0 ? (
                <Text color={textColor}>No records found</Text>
              ) : (
                annexureData.data.map(record => (
                  <Card key={record.id} bg={bgColor} w="100%" p={4}>
                    <Stack direction="column" align="start" spacing={2}>
                      <Text fontSize="sm">Academic Year: {record.academic_year || 'N/A'}</Text>
                      <Text fontSize="sm">Batch: {record.batch || 'N/A'}</Text>
                      <Text fontSize="sm">Semester: {record.semester || 'N/A'}</Text>
                      <Text fontSize="sm">Course Code: {record.course_code || 'N/A'}</Text>
                      <Text fontSize="sm">Course Title: {record.course_title || 'N/A'}</Text>
                      <Text fontSize="sm">Credits: {record.credits || 'N/A'}</Text>
                      <Text fontSize="sm">Capacity: {record.capacity || 'N/A'}</Text>
                      <Text fontSize="sm">Year: {record.year || 'N/A'}</Text>
                      <Text fontSize="sm">Attribute: {record.attribute || 'N/A'}</Text>
                      <Text fontSize="sm">Category: {record.category || 'N/A'}</Text>
                      <Text fontSize="sm">Short Name: {record.short_name || 'N/A'}</Text>
                      <Text fontSize="sm">Department: {record.department || 'N/A'}</Text>
                      <Text fontSize="sm">Area: {record.area || 'N/A'}</Text>
                      <Text fontSize="sm">Course Type: {record.course_type || 'N/A'}</Text>
                      <Text fontSize="sm">Sessions: {record.sessions || 'N/A'}</Text>
                      <HStack spacing={2}>
                        <IconButton
                          icon={<PencilSquareIcon className="h-4 w-4" />}
                          variant="outline"
                          colorScheme="blue"
                          size="sm"
                          onClick={() => handleEditClick(record)}
                        />
                      </HStack>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>
          )}
        </Box>
      </Card>

      {/* Edit Modal - unchanged */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Annexure Record</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selectedAnnexure && (
              <Stack direction="column" spacing={4}>
                <FormControl isReadOnly><FormLabel>Code</FormLabel><Input value={editForm.code} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Academic Year</FormLabel><Input value={editForm.academic_year} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Batch</FormLabel><Input value={editForm.batch} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Semester</FormLabel><Input value={editForm.semester} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Course Code</FormLabel><Input value={editForm.course_code} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Course Title</FormLabel><Input value={editForm.course_title} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Credits</FormLabel><Input value={editForm.credits} variant="filled" /></FormControl>
                <FormControl><FormLabel>Capacity</FormLabel><Input value={editForm.capacity} onChange={e => setEditForm({ ...editForm, capacity: e.target.value })} /></FormControl>
                <FormControl isReadOnly><FormLabel>Year</FormLabel><Input value={editForm.year} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Attribute</FormLabel><Input value={editForm.attribute} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Category</FormLabel><Input value={editForm.category} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Short Name</FormLabel><Input value={editForm.short_name} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Department</FormLabel><Input value={editForm.department} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Area</FormLabel><Input value={editForm.area} variant="filled" /></FormControl>
                <FormControl isReadOnly><FormLabel>Course Type</FormLabel><Input value={editForm.course_type} variant="filled" /></FormControl>
                <FormControl><FormLabel>Sessions</FormLabel><Input value={editForm.sessions} onChange={e => setEditForm({ ...editForm, sessions: e.target.value })} /></FormControl>
              </Stack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" mr={3} onClick={onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleSubmit}>Save Changes</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}

export default Annexure;
