// src/pages/ApplicantsView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Flex, Text, VStack, HStack, Input, InputGroup,
  InputLeftElement, InputRightElement, Button, ButtonGroup,
  IconButton, Spinner, Select, Badge, Tooltip,
  Table, Thead, Tbody, Tr, Th, Td,
  useColorModeValue, useToast,
  Popover, PopoverTrigger, PopoverContent, PopoverArrow, PopoverBody, Portal,
  Skeleton,
} from '@chakra-ui/react';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { TableVirtuoso } from 'react-virtuoso';
import PageHeader from '../components/layout/PageHeader';

const AWARD_TABS = [
  { key: 'all',         label: 'All',              color: 'purple' },
  { key: 'sports',      label: 'Sports Awards',     color: 'blue'   },
  { key: 'cultural',    label: 'Cultural Awards',   color: 'pink'   },
  { key: 'trailblazer', label: 'Trailblazer Awards',color: 'orange' },
];

const AWARD_BADGE = {
  'Sports Award':      { colorScheme: 'blue',   label: 'Sports'      },
  'Cultural Award':    { colorScheme: 'pink',   label: 'Cultural'    },
  'Trailblazer Award': { colorScheme: 'orange', label: 'Trailblazer' },
};

const GRADIENT = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

async function fetchApplicants(params) {
  const qs = new URLSearchParams(params).toString();
  const deviceId = localStorage.getItem('deviceId') || '';
  const res = await fetch(`/api/applicants?${qs}`, {
    credentials: 'include',
    headers: { 'x-device-id': deviceId },
  });
  if (!res.ok) throw new Error('Failed to fetch applicants');
  return res.json();
}

function SortButton({ field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <HStack spacing={0}>
      <IconButton
        icon={<ChevronUpIcon className="h-3 w-3" />}
        size="xs" variant="ghost"
        color={active && sortDir === 'asc' ? 'yellow.300' : 'whiteAlpha.700'}
        onClick={() => onSort(field, 'asc')}
        aria-label={`Sort ${field} asc`}
        minW="auto" h="auto" p="1"
      />
      <IconButton
        icon={<ChevronDownIcon className="h-3 w-3" />}
        size="xs" variant="ghost"
        color={active && sortDir === 'desc' ? 'yellow.300' : 'whiteAlpha.700'}
        onClick={() => onSort(field, 'desc')}
        aria-label={`Sort ${field} desc`}
        minW="auto" h="auto" p="1"
      />
    </HStack>
  );
}

function ApplicantsView() {
  const toast   = useToast();
  const bgColor   = useColorModeValue('white', 'gray.800');
  const textColor = useColorModeValue('gray.700', 'gray.200');
  const subColor  = useColorModeValue('gray.500', 'gray.400');
  const borderColor = useColorModeValue('gray.200', 'gray.600');
  const hoverBg   = useColorModeValue('gray.50', 'gray.700');
  const titleColor = useColorModeValue('gray.800', 'white');

  const [data, setData]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [filters, setFilters]   = useState({ genders: [], batches: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Query params
  const [awardTab,   setAwardTab]   = useState('all');
  const [search,     setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [gender,     setGender]     = useState('');
  const [batch,      setBatch]      = useState('');
  const [sortField,  setSortField]  = useState('');
  const [sortDir,    setSortDir]    = useState('asc');

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await fetchApplicants({
        award_type: awardTab,
        search,
        gender,
        batch,
        sort_field: sortField,
        sort_dir:   sortDir,
      });
      setData(result.data || []);
      setTotal(result.total || 0);
      setFilters(result.filters || { genders: [], batches: [] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 3000 });
    } finally {
      setIsLoading(false);
    }
  }, [awardTab, search, gender, batch, sortField, sortDir]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (field, dir) => {
    setSortField(field);
    setSortDir(dir);
  };

  const clearFilters = () => {
    setGender('');
    setBatch('');
    setSearchInput('');
    setSearch('');
    setSortField('');
    setSortDir('asc');
  };

  const hasFilters = gender || batch || search || sortField;

  // Determine which score columns to show based on active tab
  const showSports      = awardTab === 'all' || awardTab === 'sports'      || awardTab === 'trailblazer';
  const showCultural    = awardTab === 'all' || awardTab === 'cultural'     || awardTab === 'trailblazer';
  const showVerSports   = awardTab === 'all' || awardTab === 'sports'       || awardTab === 'trailblazer';
  const showVerCultural = awardTab === 'all' || awardTab === 'cultural'     || awardTab === 'trailblazer';

  const ThCell = ({ children, field, sortable }) => (
    <Th
      color="white"
      borderRight="1px solid rgba(255,255,255,0.2)"
      borderBottom="1px solid rgba(255,255,255,0.2)"
      whiteSpace="nowrap"
      py={3}
    >
      <Flex align="center" gap={1}>
        <Text color="white" fontSize="xs">{children}</Text>
        {sortable && (
          <SortButton field={field} sortField={sortField} sortDir={sortDir} onSort={handleSort} />
        )}
      </Flex>
    </Th>
  );

  const TdCell = ({ children, minW }) => (
    <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor} minW={minW}>
      <Text fontSize="sm" color={textColor}>{children || '—'}</Text>
    </Td>
  );

  return (
    <Box p={[2, 4, 6]} pt={[1, 2, 3]}>
      <PageHeader
        title="Award Applicants"
        description="View all applicants across Sports, Cultural and Trailblazer awards"
      />

      <Card variant="outline" bg={bgColor} overflow="hidden">
        <Box px={6} py={4}>

          {/* Award Type Tabs */}
          <HStack spacing={2} mb={5} flexWrap="wrap">
            {AWARD_TABS.map(tab => (
              <Button
                key={tab.key}
                size="sm"
                borderRadius="full"
                colorScheme={tab.color}
                variant={awardTab === tab.key ? 'solid' : 'outline'}
                onClick={() => setAwardTab(tab.key)}
                fontWeight={awardTab === tab.key ? 'bold' : 'normal'}
              >
                {tab.label}
              </Button>
            ))}
          </HStack>

          {/* Search + Filters Row */}
          <Flex justify="space-between" align="center" mb={4} flexWrap="wrap" gap={3}>
            <HStack spacing={2} flexWrap="wrap">
              {/* Search */}
              <InputGroup maxW="280px">
                <InputLeftElement pointerEvents="none">
                  <MagnifyingGlassIcon className="h-5 w-5" style={{ color: 'gray' }} />
                </InputLeftElement>
                <Input
                  placeholder="Search name, ID or email..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  borderRadius="lg"
                />
                {searchInput !== search && (
                  <InputRightElement><Spinner size="sm" /></InputRightElement>
                )}
              </InputGroup>

              {/* Gender Filter */}
              <Select
                placeholder="All Genders"
                value={gender}
                onChange={e => setGender(e.target.value)}
                maxW="140px"
                size="md"
                borderRadius="lg"
              >
                {filters.genders.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>

              {/* Batch Filter */}
              <Select
                placeholder="All Batches"
                value={batch}
                onChange={e => setBatch(e.target.value)}
                maxW="150px"
                size="md"
                borderRadius="lg"
              >
                {filters.batches.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>

              {/* Clear filters */}
              {hasFilters && (
                <Tooltip label="Clear all filters" hasArrow>
                  <IconButton
                    icon={<XMarkIcon className="h-5 w-5" />}
                    variant="ghost"
                    colorScheme="red"
                    onClick={clearFilters}
                    aria-label="Clear filters"
                  />
                </Tooltip>
              )}
            </HStack>

            <Text color={subColor} fontSize="sm">
              {isLoading ? <Skeleton height="20px" width="160px" /> : `Showing ${data.length} of ${total} records`}
            </Text>
          </Flex>
        </Box>

        {/* Table */}
        <Box overflowX="auto">
          {isLoading ? (
            <Box px={6} py={4}>
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} height="44px" mb={2} borderRadius="md" />
              ))}
            </Box>
          ) : (
            <TableVirtuoso
              data={data}
              style={{ height: 'calc(100vh - 340px)', minHeight: '300px' }}
              components={{
                Table: ({ style, ...props }) => <Table {...props} style={style} />,
                TableHead: Thead,
                TableRow: ({ item, ...props }) => <Tr {...props} _hover={{ bg: hoverBg }} />,
                TableBody: React.forwardRef(({ ...props }, ref) => <Tbody {...props} ref={ref} />),
                EmptyPlaceholder: () => (
                  <Tr>
                    <Td colSpan={12} textAlign="center" py={12} color={subColor}>
                      No applicants found
                    </Td>
                  </Tr>
                ),
              }}
              fixedHeaderContent={() => (
                <Tr bg={GRADIENT} backgroundImage={GRADIENT}>
                  {/* Student (name + id + email stacked) */}
                  <Th color="white" borderRight="1px solid rgba(255,255,255,0.2)" borderBottom="1px solid rgba(255,255,255,0.2)" minW="200px" py={3}>
                    <Text color="white" fontSize="xs">Student</Text>
                  </Th>
                  <ThCell>Gender</ThCell>
                  <ThCell>Batch</ThCell>
                  <ThCell>Award Type</ThCell>
                  {showSports    && <ThCell field="sports_score"          sortable>Sports Score</ThCell>}
                  {showCultural  && <ThCell field="cultural_score"        sortable>Cultural Score</ThCell>}
                  {showVerSports   && <ThCell field="sports_verified_score"   sortable>Verified Sports</ThCell>}
                  {showVerCultural && <ThCell field="cultural_verified_score" sortable>Verified Cultural</ThCell>}
                  <ThCell field="submission_date" sortable>Submitted</ThCell>
                  <ThCell>Status</ThCell>
                </Tr>
              )}
              itemContent={(index, record) => {
                const badge = AWARD_BADGE[record.award_type] || {};
                return (
                  <>
                    {/* Student VStack */}
                    <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor} minW="200px">
                      <VStack align="start" spacing={0}>
                        <Text fontSize="sm" fontWeight="600" color={titleColor} noOfLines={1}>
                          {record.name || '—'}
                        </Text>
                        <Text fontSize="xs" color="blue.500" fontFamily="mono">
                          {record.student_id || '—'}
                        </Text>
                        <Text fontSize="xs" color={subColor} noOfLines={1}>
                          {record.email || '—'}
                        </Text>
                      </VStack>
                    </Td>
                    <TdCell>{record.gender}</TdCell>
                    <TdCell>{record.batch}</TdCell>
                    <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                      <Badge colorScheme={badge.colorScheme} borderRadius="full" px={2}>
                        {badge.label || record.award_type}
                      </Badge>
                    </Td>
                    {showSports    && <TdCell>{record.sports_score}</TdCell>}
                    {showCultural  && <TdCell>{record.cultural_score}</TdCell>}
                    {showVerSports   && (
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text
                          fontSize="sm"
                          color={record.sports_verified_score ? 'green.500' : subColor}
                          fontWeight={record.sports_verified_score ? '600' : 'normal'}
                        >
                          {record.sports_verified_score || '—'}
                        </Text>
                      </Td>
                    )}
                    {showVerCultural && (
                      <Td borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                        <Text
                          fontSize="sm"
                          color={record.cultural_verified_score ? 'green.500' : subColor}
                          fontWeight={record.cultural_verified_score ? '600' : 'normal'}
                        >
                          {record.cultural_verified_score || '—'}
                        </Text>
                      </Td>
                    )}
                    <TdCell>
                      {record.submission_date
                        ? new Date(record.submission_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </TdCell>
                    <Td borderColor={borderColor}>
                      <Badge
                        colorScheme={record.status === 'Submitted' ? 'green' : 'gray'}
                        borderRadius="full"
                        fontSize="xs"
                      >
                        {record.status || 'Submitted'}
                      </Badge>
                    </Td>
                  </>
                );
              }}
            />
          )}
        </Box>
      </Card>
    </Box>
  );
}

export default ApplicantsView;
