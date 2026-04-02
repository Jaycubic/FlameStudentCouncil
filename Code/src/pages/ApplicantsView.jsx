// src/pages/ApplicantsView.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Card, Flex, Text, VStack, HStack, Input, InputGroup,
  InputLeftElement, InputRightElement, Button, ButtonGroup,
  IconButton, Spinner, Select, Badge, Tooltip,
  Table, Thead, Tbody, Tr, Th, Td,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, ModalFooter, Divider, Avatar, Link, Tag,
  useColorModeValue, useToast, useDisclosure, Skeleton, SimpleGrid,
} from '@chakra-ui/react';
import {
  MagnifyingGlassIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentIcon,
  TableCellsIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  CloudArrowUpIcon,
  CloudArrowDownIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { TableVirtuoso } from 'react-virtuoso';
import PageHeader from '../components/layout/PageHeader';
import { applicantsService } from '../services/applicantsService';

const AWARD_TABS = [
  { key: 'all',         label: 'All',                        color: 'purple' },
  { key: 'sports',      label: 'Sports Person Award',        color: 'blue'   },
  { key: 'cultural',    label: 'Co-curricular Person Award', color: 'pink'   },
  { key: 'trailblazer', label: 'Trailblazer Awards',         color: 'orange' },
];

const AWARD_BADGE = {
  'Sports Person Award':        { colorScheme: 'blue',   label: 'Sports',      awardKey: 'sports'      },
  'Co-curricular Person Award': { colorScheme: 'pink',   label: 'Co-curricular', awardKey: 'cultural'    },
  'Trailblazer Award':          { colorScheme: 'orange', label: 'Trailblazer', awardKey: 'trailblazer' },
};

const GRADIENT = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
const PAGE_LIMIT = 50;

// ─── Sort arrows ──────────────────────────────────────────────────────────────
function SortBtn({ field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <Flex direction="column" ml={1}>
      <IconButton icon={<ChevronUpIcon style={{ width: 10, height: 10 }} />}
        size="xs" variant="ghost" minW="auto" h="auto" p="0"
        color={active && sortDir === 'asc' ? 'yellow.300' : 'whiteAlpha.600'}
        onClick={() => onSort(field, 'asc')} aria-label={`sort ${field} asc`} />
      <IconButton icon={<ChevronDownIcon style={{ width: 10, height: 10 }} />}
        size="xs" variant="ghost" minW="auto" h="auto" p="0"
        color={active && sortDir === 'desc' ? 'yellow.300' : 'whiteAlpha.600'}
        onClick={() => onSort(field, 'desc')} aria-label={`sort ${field} desc`} />
    </Flex>
  );
}

// ─── Section Header (identical pattern to MyFacultyProfile) ───────────────────
function SectionHeader({ title, isEditing, onToggle, onSave, isLoading }) {
  return (
    <Flex justify="space-between" align="center" mb={3}>
      <Text fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="wider"
        color={useColorModeValue('gray.400', 'gray.500')}>{title}</Text>
      <HStack spacing={1}>
        {isEditing ? (
          <>
            <IconButton size="xs" icon={<CheckCircleIcon style={{ width: 14, height: 14 }} />}
              colorScheme="green" variant="ghost" onClick={onSave} isLoading={isLoading} aria-label="Save" />
            <IconButton size="xs" icon={<XMarkIcon style={{ width: 14, height: 14 }} />}
              colorScheme="red" variant="ghost" onClick={onToggle} isDisabled={isLoading} aria-label="Cancel" />
          </>
        ) : (
          <IconButton size="xs" icon={<PencilSquareIcon style={{ width: 14, height: 14 }} />}
            variant="ghost" color="gray.400" _hover={{ color: 'blue.500' }}
            onClick={onToggle} aria-label="Edit" />
        )}
      </HStack>
    </Flex>
  );
}

// ─── Editable field row ────────────────────────────────────────────────────────
function EditableField({ label, value, fieldKey, isEditing, form, onChange, color }) {
  const labelColor = useColorModeValue('gray.400', 'gray.500');
  const valueColor = color || useColorModeValue('gray.700', 'gray.200');
  return (
    <Box>
      <Text fontSize="9px" fontWeight="700" textTransform="uppercase" letterSpacing="wider"
        color={labelColor} mb={0.5}>{label}</Text>
      {isEditing ? (
        <Input size="xs" value={form[fieldKey] ?? ''} borderRadius="md" focusBorderColor="blue.400"
          onChange={e => onChange(fieldKey, e.target.value)} />
      ) : (
        <Text fontSize="12px" fontWeight="500" color={valueColor}>{value || '—'}</Text>
      )}
    </Box>
  );
}

// ─── Profile Modal ─────────────────────────────────────────────────────────────
function ProfileModal({ isOpen, onClose, record, onUpdate }) {
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState({});
  const toast    = useToast();
  const subColor = useColorModeValue('gray.500', 'gray.400');
  const cardBg   = useColorModeValue('gray.50',  'gray.700');
  const divColor = useColorModeValue('gray.100', 'gray.600');

  useEffect(() => {
    if (!isOpen || !record) return;
    const awardKey = AWARD_BADGE[record.award_type]?.awardKey;
    if (!awardKey) return;
    setProfile(null);
    setIsEditing(false);
    setLoading(true);
    applicantsService.getProfile(awardKey, record.id)
      .then(res => {
        setProfile(res.data);
        resetForm(res.data);
      })
      .catch(err => toast({ title: 'Error', description: err.message, status: 'error', duration: 3000 }))
      .finally(() => setLoading(false));
  }, [isOpen, record]);

  const resetForm = (p) => setForm({
    academic_score:          p?.academic_score          ?? '',
    sports_score:            p?.sports_score            ?? '',
    cultural_score:          p?.cultural_score          ?? '',
    sports_verified_score:   p?.sports_verified_score   ?? '',
    cultural_verified_score: p?.cultural_verified_score ?? '',
  });

  const handleChange = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    const awardKey = AWARD_BADGE[record.award_type]?.awardKey;
    try {
      const res = await applicantsService.updateApplicant(awardKey, profile.id, form);
      const updated = { ...profile, ...res.data };
      setProfile(updated);
      resetForm(updated);
      setIsEditing(false);
      // Patch the parent table row so it reflects new values immediately
      if (onUpdate) onUpdate(record.id, record.award_type, res.data);
      toast({ title: 'Saved', status: 'success', duration: 2000 });
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, status: 'error', duration: 3000 });
    } finally { setSaving(false); }
  };

  const handleCancel = () => { resetForm(profile); setIsEditing(false); };

  const photoUrl = profile?.photo ? `/api/photos/${profile.photo}` : null;
  const badge    = AWARD_BADGE[record?.award_type] || {};

  // Which fields to show per award type
  const awardKey      = badge.awardKey;
  const showSports    = awardKey === 'sports'      || awardKey === 'trailblazer';
  const showCultural  = awardKey === 'cultural'    || awardKey === 'trailblazer';
  const showAcademicScore = awardKey === 'trailblazer';

  const InfoRow = ({ label, value }) => (
    <Box>
      <Text fontSize="9px" fontWeight="700" textTransform="uppercase" letterSpacing="wider"
        color={useColorModeValue('gray.400', 'gray.500')} mb={0.5}>{label}</Text>
      <Text fontSize="12px" fontWeight="500">{value || '—'}</Text>
    </Box>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(4px)" />
      <ModalContent borderRadius="2xl">
        {/* ── Gradient Header ─────────────────────────────────────────────── */}
        <Box bgGradient={GRADIENT} borderTopRadius="2xl" px={6} py={5}>
          <ModalCloseButton color="white" top={3} />
          {loading ? (
            <HStack spacing={4}>
              <Skeleton w="72px" h="72px" borderRadius="full" />
              <VStack align="start" spacing={1}>
                <Skeleton h="18px" w="180px" /><Skeleton h="12px" w="120px" />
              </VStack>
            </HStack>
          ) : profile ? (
            <HStack spacing={4} align="center" flexWrap="wrap">
              <Avatar size="lg" name={profile.name} src={photoUrl || undefined}
                border="3px solid white" boxShadow="lg" />
              <VStack align="start" spacing={0}>
                <Text color="white" fontWeight="700" fontSize="lg">{profile.name}</Text>
                <Text color="whiteAlpha.800" fontSize="12px" fontFamily="mono">{profile.student_id}</Text>
                <Text color="whiteAlpha.700" fontSize="11px">{profile.email}</Text>
              </VStack>
              <Box ml="auto">
                {/* Award type badge — always visible */}
                <Badge colorScheme={badge.colorScheme} borderRadius="full" px={3} py={1} fontSize="11px"
                  textTransform="uppercase" letterSpacing="wide">
                  {badge.label} Award
                </Badge>
              </Box>
            </HStack>
          ) : null}
        </Box>

        <ModalBody py={5} px={6}>
          {loading ? (
            <VStack spacing={3}>
              {[...Array(6)].map((_, i) => <Skeleton key={i} h="32px" borderRadius="md" />)}
            </VStack>
          ) : profile ? (
            <VStack spacing={5} align="stretch">

              {/* ── Read-only identity fields ──────────────────────────────── */}
              <SimpleGrid columns={3} spacing={4}>
                <InfoRow label="Gender"    value={profile.gender} />
                <InfoRow label="Batch"     value={profile.batch}  />
                <InfoRow label="Mobile"    value={profile.mobile_number} />
                <InfoRow label="Submitted"
                  value={profile.submission_date
                    ? new Date(profile.submission_date).toLocaleDateString('en-IN',
                        { day: '2-digit', month: 'short', year: 'numeric' })
                    : null} />
              </SimpleGrid>

              <Divider borderColor={divColor} />

              {/* ── Inline-editable score section ──────────────────────────── */}
              <Box bg={cardBg} borderRadius="xl" p={4}>
                <SectionHeader
                  title="Scores & Verified Scores"
                  isEditing={isEditing}
                  onToggle={isEditing ? handleCancel : () => setIsEditing(true)}
                  onSave={handleSave}
                  isLoading={saving}
                />
                <SimpleGrid columns={isEditing ? 2 : 3} spacing={4}>
                  {showAcademicScore && (
                    <EditableField label="Academic Score"
                      value={profile.academic_score} fieldKey="academic_score"
                      isEditing={isEditing} form={form} onChange={handleChange} />
                  )}
                  {showSports && (
                    <EditableField label="Sports Score"
                      value={profile.sports_score} fieldKey="sports_score"
                      isEditing={isEditing} form={form} onChange={handleChange} />
                  )}
                  {showCultural && (
                    <EditableField label="Cultural Score"
                      value={profile.cultural_score} fieldKey="cultural_score"
                      isEditing={isEditing} form={form} onChange={handleChange} />
                  )}
                  {showSports && (
                    <EditableField label="Verified Sports"
                      value={profile.sports_verified_score} fieldKey="sports_verified_score"
                      isEditing={isEditing} form={form} onChange={handleChange}
                      color={!isEditing && profile.sports_verified_score ? 'green.500' : undefined} />
                  )}
                  {showCultural && (
                    <EditableField label="Verified Cultural"
                      value={profile.cultural_verified_score} fieldKey="cultural_verified_score"
                      isEditing={isEditing} form={form} onChange={handleChange}
                      color={!isEditing && profile.cultural_verified_score ? 'green.500' : undefined} />
                  )}
                </SimpleGrid>
              </Box>

              <Divider borderColor={divColor} />

              {/* ── Matrix Sheets ───────────────────────────────────────────── */}
              <Box>
                <Text fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="wider"
                  color={subColor} mb={2}>Matrix Sheets</Text>
                <HStack spacing={3} flexWrap="wrap">
                  {profile.sheets?.sports && (
                    <Link href={profile.sheets.sports} isExternal>
                      <Tag colorScheme="blue" borderRadius="full" cursor="pointer" size="sm">
                        <TableCellsIcon style={{ width: 12, height: 12, marginRight: 4 }} />
                        Sports Sheet
                      </Tag>
                    </Link>
                  )}
                  {profile.sheets?.cultural && (
                    <Link href={profile.sheets.cultural} isExternal>
                      <Tag colorScheme="pink" borderRadius="full" cursor="pointer" size="sm">
                        <TableCellsIcon style={{ width: 12, height: 12, marginRight: 4 }} />
                        Cultural Sheet
                      </Tag>
                    </Link>
                  )}
                  {!profile.sheets?.sports && !profile.sheets?.cultural && (
                    <Text fontSize="12px" color={subColor}>No sheets linked</Text>
                  )}
                </HStack>
              </Box>

              {/* ── Attachments ─────────────────────────────────────────────── */}
              {((profile.attachments?.sport?.length > 0) || (profile.attachments?.cultural?.length > 0)) && (
                <>
                  <Divider borderColor={divColor} />
                  <Box>
                    <Text fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="wider"
                      color={subColor} mb={2}>Attachments</Text>
                    <VStack align="start" spacing={2}>
                      {profile.attachments?.sport?.map(f => (
                        <Link key={f.id} href={applicantsService.getFileUrl('sport', f.fileName)} isExternal>
                          <HStack>
                            <DocumentIcon style={{ width: 14, height: 14, color: '#3B82F6' }} />
                            <Text fontSize="12px" color="blue.500">{f.fileName}</Text>
                          </HStack>
                        </Link>
                      ))}
                      {profile.attachments?.cultural?.map(f => (
                        <Link key={f.id} href={applicantsService.getFileUrl('cultural', f.fileName)} isExternal>
                          <HStack>
                            <DocumentIcon style={{ width: 14, height: 14, color: '#EC4899' }} />
                            <Text fontSize="12px" color="pink.500">{f.fileName}</Text>
                          </HStack>
                        </Link>
                      ))}
                    </VStack>
                  </Box>
                </>
              )}

            </VStack>
          ) : null}
        </ModalBody>

        <ModalFooter pt={0}>
          <Button size="sm" onClick={onClose} variant="ghost">Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function ApplicantsView() {
  const toast      = useToast();
  const bgColor    = useColorModeValue('white', 'gray.800');
  const textColor  = useColorModeValue('gray.700', 'gray.200');
  const subColor   = useColorModeValue('gray.400', 'gray.500');
  const borderColor= useColorModeValue('gray.200', 'gray.600');
  const hoverBg    = useColorModeValue('gray.50', 'gray.700');
  const titleColor = useColorModeValue('gray.800', 'white');

  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedRecord, setSelectedRecord] = useState(null);

  const [data,       setData]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [filterOpts, setFilterOpts] = useState({ genders: [], batches: [] });
  const [isLoading,  setIsLoading]  = useState(true);

  const [awardTab,    setAwardTab]    = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [gender,      setGender]      = useState('');
  const [batch,       setBatch]       = useState('');
  const [sortField,   setSortField]   = useState('');
  const [sortDir,     setSortDir]     = useState('asc');
  const [page,        setPage]        = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [awardTab, gender, batch, sortField, sortDir]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await applicantsService.getApplicants({
        awardType: awardTab, search, gender, batch,
        sortField, sortDir, page, limit: PAGE_LIMIT,
      });
      setData(result.data       || []);
      setTotal(result.total     || 0);
      setPages(result.pages     || 1);
      setFilterOpts(result.filters || { genders: [], batches: [] });
    } catch (err) {
      toast({ title: 'Error', description: err.message, status: 'error', duration: 4000 });
    } finally {
      setIsLoading(false);
    }
  }, [awardTab, search, gender, batch, sortField, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  const handleSort = (field, dir) => { setSortField(field); setSortDir(dir); };

  const clearFilters = () => {
    setGender(''); setBatch(''); setSearchInput('');
    setSearch(''); setSortField(''); setSortDir('asc'); setPage(1);
  };
  const hasFilters = gender || batch || search || sortField;

  const openProfile = (record) => { setSelectedRecord(record); onOpen(); };

  // Patch the in-memory data row after a profile save — no reload needed
  const handleProfileUpdate = (recordId, awardType, updatedFields) => {
    setData(prev => prev.map(row =>
      row.id === recordId && row.award_type === awardType
        ? { ...row, ...updatedFields }
        : row
    ));
  };

  // ── Workbook handlers ────────────────────────────────────────────────────────
  const [sheetLoading,     setSheetLoading]     = useState(false);
  const [syncDownLoading,  setSyncDownLoading]  = useState(false);
  const [syncUpLoading,    setSyncUpLoading]    = useState(false);

  const handleOpenSheet = async () => {
    setSheetLoading(true);
    try {
      const res = await applicantsService.openWorkbook();
      if (res.success) {
        window.open(res.url, '_blank');
        if (res.isNew) toast({ title: 'Workbook created', description: 'Opened in a new tab.', status: 'success', duration: 4000 });
      }
    } catch (err) {
      toast({ title: 'Google Sheet error', description: err.message, status: 'error', duration: 5000 });
    } finally { setSheetLoading(false); }
  };

  const handleSyncFromCloud = async () => {
    setSyncDownLoading(true);
    try {
      const res = await applicantsService.syncFromCloud();
      if (res.success) {
        toast({ title: `Synced ${res.updated} record${res.updated !== 1 ? 's' : ''} from Cloud`, description: `${res.skipped} unchanged.`, status: 'success', duration: 4000 });
        load(); // refresh table
      }
    } catch (err) {
      toast({ title: 'Sync from Cloud failed', description: err.message, status: 'error', duration: 5000 });
    } finally { setSyncDownLoading(false); }
  };

  const handleSyncToCloud = async () => {
    setSyncUpLoading(true);
    try {
      const res = await applicantsService.syncToCloud();
      if (res.success) {
        toast({ title: 'Cloud Sheet updated', description: `${res.tabs_updated} tab${res.tabs_updated !== 1 ? 's' : ''} refreshed.`, status: 'success', duration: 4000 });
      }
    } catch (err) {
      toast({ title: 'Sync to Cloud failed', description: err.message, status: 'error', duration: 5000 });
    } finally { setSyncUpLoading(false); }
  };

  const showSports      = awardTab === 'all' || awardTab === 'sports'      || awardTab === 'trailblazer';
  const showCultural    = awardTab === 'all' || awardTab === 'cultural'    || awardTab === 'trailblazer';
  const showVerSports   = awardTab === 'all' || awardTab === 'sports'      || awardTab === 'trailblazer';
  const showVerCultural = awardTab === 'all' || awardTab === 'cultural'    || awardTab === 'trailblazer';

  const ThCell = ({ children, field, sortable, minW = 'auto' }) => (
    <Th color="white" px={2} py={2} minW={minW}
      borderRight="1px solid rgba(255,255,255,0.15)"
      borderBottom="1px solid rgba(255,255,255,0.15)"
      fontSize="10px" fontWeight="700" textTransform="uppercase" letterSpacing="0.03em" whiteSpace="nowrap"
    >
      <Flex align="center">
        <Text color="white">{children}</Text>
        {sortable && <SortBtn field={field} sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
      </Flex>
    </Th>
  );

  const TdCell = ({ children, color }) => (
    <Td px={2} py={1} borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
      <Text fontSize="11px" color={color || textColor} noOfLines={1}>{children ?? '—'}</Text>
    </Td>
  );

  return (
    <Box p={[2, 4, 6]} pt={[1, 2, 3]}>
      <PageHeader title="Award Applicants" description="All applicants across Sports, Cultural and Trailblazer awards" />

      <Card variant="outline" bg={bgColor} overflow="hidden">
        <Box px={5} py={3}>
          {/* Tabs + Workbook buttons on same row */}
          <Flex align="center" justify="space-between" mb={3} flexWrap="wrap" gap={2}>
            <HStack spacing={2} flexWrap="wrap">
              {AWARD_TABS.map(tab => (
                <Button key={tab.key} size="xs" borderRadius="full"
                  colorScheme={tab.color}
                  variant={awardTab === tab.key ? 'solid' : 'outline'}
                  onClick={() => setAwardTab(tab.key)}
                  fontWeight={awardTab === tab.key ? '700' : '500'}
                >
                  {tab.label}
                </Button>
              ))}
            </HStack>

            {/* ─── Workbook action buttons ─────── */}
            <HStack spacing={2}>
              <Tooltip label="Open / generate the admin Google Sheet workbook" hasArrow placement="bottom">
                <Button
                  size="sm"
                  leftIcon={<ArrowTopRightOnSquareIcon style={{ width: 14, height: 14 }} />}
                  colorScheme="green"
                  variant="solid"
                  borderRadius="lg"
                  fontSize="12px"
                  fontWeight="600"
                  isLoading={sheetLoading}
                  loadingText="Opening…"
                  onClick={handleOpenSheet}
                  boxShadow="sm"
                  _hover={{ transform: 'translateY(-1px)', boxShadow: 'md' }}
                  transition="all 0.15s"
                >
                  Google Sheet
                </Button>
              </Tooltip>

              <Tooltip label="Pull cloud edits → Update local DB" hasArrow placement="bottom">
                <Button
                  size="sm"
                  leftIcon={<CloudArrowDownIcon style={{ width: 14, height: 14 }} />}
                  colorScheme="blue"
                  variant="outline"
                  borderRadius="lg"
                  fontSize="12px"
                  fontWeight="600"
                  isLoading={syncDownLoading}
                  loadingText="Syncing…"
                  onClick={handleSyncFromCloud}
                  boxShadow="sm"
                  _hover={{ transform: 'translateY(-1px)', boxShadow: 'md' }}
                  transition="all 0.15s"
                >
                  Sync ↓
                </Button>
              </Tooltip>

              <Tooltip label="Push local changes → Update Google Sheet" hasArrow placement="bottom">
                <Button
                  size="sm"
                  leftIcon={<CloudArrowUpIcon style={{ width: 14, height: 14 }} />}
                  colorScheme="purple"
                  variant="outline"
                  borderRadius="lg"
                  fontSize="12px"
                  fontWeight="600"
                  isLoading={syncUpLoading}
                  loadingText="Pushing…"
                  onClick={handleSyncToCloud}
                  boxShadow="sm"
                  _hover={{ transform: 'translateY(-1px)', boxShadow: 'md' }}
                  transition="all 0.15s"
                >
                  Sync ↑
                </Button>
              </Tooltip>
            </HStack>
          </Flex>

          {/* Single filter row */}
          <Flex align="center" gap={2} mb={3} flexWrap="wrap">
            <InputGroup size="sm" maxW="230px">
              <InputLeftElement pointerEvents="none">
                <MagnifyingGlassIcon style={{ width: 14, height: 14, color: 'gray' }} />
              </InputLeftElement>
              <Input placeholder="Name, ID or email…" value={searchInput}
                onChange={e => setSearchInput(e.target.value)} borderRadius="lg" fontSize="12px" />
              {searchInput !== search && <InputRightElement><Spinner size="xs" /></InputRightElement>}
            </InputGroup>

            <Select size="sm" maxW="120px" borderRadius="lg" fontSize="12px"
              value={gender} onChange={e => setGender(e.target.value)} placeholder="All Genders">
              {filterOpts.genders.map(g => <option key={g} value={g}>{g}</option>)}
            </Select>

            <Select size="sm" maxW="130px" borderRadius="lg" fontSize="12px"
              value={batch} onChange={e => setBatch(e.target.value)} placeholder="All Batches">
              {filterOpts.batches.map(b => <option key={b} value={b}>{b}</option>)}
            </Select>

            {hasFilters && (
              <Tooltip label="Clear filters" hasArrow>
                <IconButton icon={<XMarkIcon style={{ width: 14, height: 14 }} />}
                  size="sm" variant="ghost" colorScheme="red" onClick={clearFilters} aria-label="Clear" />
              </Tooltip>
            )}

            <Text ml="auto" fontSize="11px" color={subColor} whiteSpace="nowrap">
              {isLoading
                ? <Skeleton height="14px" width="120px" display="inline-block" />
                : `${Math.min((page - 1) * PAGE_LIMIT + 1, total)}–${Math.min(page * PAGE_LIMIT, total)} of ${total}`}
            </Text>

            <ButtonGroup size="sm" isAttached>
              <IconButton icon={<ChevronLeftIcon style={{ width: 14, height: 14 }} />}
                onClick={() => setPage(p => Math.max(1, p - 1))} isDisabled={page <= 1 || isLoading} aria-label="Prev" />
              <Button minW="72px" fontSize="11px" isDisabled>
                {isLoading ? <Spinner size="xs" /> : `${page} / ${pages}`}
              </Button>
              <IconButton icon={<ChevronRightIcon style={{ width: 14, height: 14 }} />}
                onClick={() => setPage(p => Math.min(pages, p + 1))} isDisabled={page >= pages || isLoading} aria-label="Next" />
            </ButtonGroup>
          </Flex>
        </Box>

        {/* Table */}
        <Box overflowX="auto">
          {isLoading ? (
            <Box px={5} pb={4}>
              {[...Array(10)].map((_, i) => <Skeleton key={i} height="32px" mb={1} borderRadius="md" />)}
            </Box>
          ) : (
            <TableVirtuoso
              data={data}
              style={{ height: 'calc(100vh - 320px)', minHeight: '280px' }}
              components={{
                Table: ({ style, ...props }) => <Table {...props} style={{ ...style, tableLayout: 'auto' }} size="sm" />,
                TableHead: Thead,
                TableRow: ({ item, ...props }) => <Tr {...props} _hover={{ bg: hoverBg }} />,
                TableBody: React.forwardRef(({ ...props }, ref) => <Tbody {...props} ref={ref} />),
                EmptyPlaceholder: () => (
                  <Tr><Td colSpan={12} textAlign="center" py={10} color={subColor} fontSize="13px">
                    No applicants found
                  </Td></Tr>
                ),
              }}
              fixedHeaderContent={() => (
                <Tr backgroundImage={GRADIENT}>
                  <ThCell minW="160px">Student</ThCell>
                  <ThCell minW="60px">Gender</ThCell>
                  <ThCell minW="75px">Batch</ThCell>
                  <ThCell minW="90px">Award</ThCell>
                  {showSports      && <ThCell field="sports_score"            sortable minW="70px">Sports</ThCell>}
                  {showCultural    && <ThCell field="cultural_score"          sortable minW="72px">Cultural</ThCell>}
                  {showVerSports   && <ThCell field="sports_verified_score"   sortable minW="72px">Ver. Sports</ThCell>}
                  {showVerCultural && <ThCell field="cultural_verified_score" sortable minW="78px">Ver. Cultural</ThCell>}
                  <ThCell field="submission_date" sortable minW="80px">Submitted</ThCell>
                  <ThCell minW="90px">Action</ThCell>
                </Tr>
              )}
              itemContent={(_, record) => {
                const badge = AWARD_BADGE[record.award_type] || {};
                return (
                  <>
                    {/* Student VStack */}
                    <Td px={2} py={1} borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor} minW="160px">
                      <VStack align="start" spacing={0} lineHeight="1.3">
                        <Text fontSize="11px" fontWeight="600" color={titleColor} noOfLines={1}>{record.name || '—'}</Text>
                        <Text fontSize="10px" color="blue.500" fontFamily="mono">{record.student_id || '—'}</Text>
                        <Text fontSize="10px" color={subColor} noOfLines={1}>{record.email || '—'}</Text>
                      </VStack>
                    </Td>
                    <TdCell>{record.gender}</TdCell>
                    <TdCell>{record.batch}</TdCell>
                    {/* Award badge */}
                    <Td px={2} py={1} borderColor={borderColor} borderRight="1px solid" borderRightColor={borderColor}>
                      <Badge colorScheme={badge.colorScheme} borderRadius="full" px={2} fontSize="10px">
                        {badge.label}
                      </Badge>
                    </Td>
                    {showSports      && <TdCell>{record.sports_score}</TdCell>}
                    {showCultural    && <TdCell>{record.cultural_score}</TdCell>}
                    {showVerSports   && <TdCell color={record.sports_verified_score ? 'green.500' : subColor}>{record.sports_verified_score}</TdCell>}
                    {showVerCultural && <TdCell color={record.cultural_verified_score ? 'green.500' : subColor}>{record.cultural_verified_score}</TdCell>}
                    <TdCell>
                      {record.submission_date
                        ? new Date(record.submission_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
                        : '—'}
                    </TdCell>
                    {/* Action */}
                    <Td px={2} py={1} borderColor={borderColor}>
                      <Button size="xs" colorScheme="blue" variant="outline" borderRadius="full"
                        fontSize="10px" onClick={() => openProfile(record)}>
                        View Profile
                      </Button>
                    </Td>
                  </>
                );
              }}
            />
          )}
        </Box>
      </Card>

      {/* Profile Modal */}
      <ProfileModal isOpen={isOpen} onClose={onClose} record={selectedRecord} onUpdate={handleProfileUpdate} />
    </Box>
  );
}

export default ApplicantsView;
