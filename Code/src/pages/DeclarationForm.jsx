// src/pages/WellbeingDeclarations.jsx
import { useEffect, useState } from 'react';
import {
  Box, Table, Thead, Tbody, Tr, Th, Td,
  IconButton, VStack, useToast, Spinner,
  Flex, Text, Card, Button, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, FormControl, FormLabel,
  Input, Checkbox, Image, Select, HStack, Stack,
  useColorModeValue,
} from '@chakra-ui/react';
import {
  PencilSquareIcon,
  TrashIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import wellbeingService from '../services/wellbeingService';

export default function WellbeingDeclarations() {
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewItem, setViewItem] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const toast = useToast();
  const bgColor = useColorModeValue('white','gray.800');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';
  const ATTACH_BASE = 'https://flamestudentcouncil.in:5050/api/wellbeing-form/attachments';

  // fetch & init
  const fetchAll = async () => {
    setLoading(true);
    try {
      const all = await wellbeingService.getAll();
      setData(all);
      setFiltered(all);
      setPrograms(Array.from(new Set(all.map(d => d.program))));
    } catch (e) {
      toast({ title:'Error', description:e.message, status:'error' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchAll(); }, []);

  // filtering
  useEffect(() => {
    let temp = data;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      temp = temp.filter(d =>
        d.fullName.toLowerCase().includes(term) ||
        d.studentId.toLowerCase().includes(term) ||
        d.email.toLowerCase().includes(term)
      );
    }
    if (programFilter) {
      temp = temp.filter(d => d.program === programFilter);
    }
    setFiltered(temp);
  }, [searchTerm, programFilter, data]);

  const openEdit = i => { setEditItem(i); setForm({ ...i }); };
  const closeEdit = () => setEditItem(null);
  const handleUpdate = async () => {
    try {
      await wellbeingService.update(editItem.id, form);
      toast({ title:'Updated', status:'success' });
      closeEdit();
      fetchAll();
    } catch (e) {
      toast({ title:'Error', description:e.message, status:'error' });
    }
  };
  const handleDelete = async id => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await wellbeingService.delete(id);
      toast({ title:'Deleted', status:'success' });
      fetchAll();
    } catch (e) {
      toast({ title:'Error', description:e.message, status:'error' });
    }
  };
  const openView = i => setViewItem(i);
  const closeView = () => setViewItem(null);

  const exportToExcel = () => {
    const sheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Declarations');
    const wbout = XLSX.write(wb, { bookType:'xlsx', type:'array' });
    saveAs(new Blob([wbout],{type:'application/octet-stream'}), 'wellbeing_declarations.xlsx');
  };

  if (loading) return <Flex justify="center" py={20}><Spinner size="xl" /></Flex>;

  return (
    <Box p={8}>
      <Card bg={bgColor} p={4} overflowX="auto">
        <HStack justify="space-between" mb={4}>
          <Text fontSize="2xl">Wellbeing Declarations</Text>
          <Button
            leftIcon={<DocumentArrowDownIcon className="h-5 w-5"/>}
            colorScheme="blue"
            onClick={exportToExcel}
          >
            Export to Excel
          </Button>
        </HStack>

        <Stack direction={{ base:'column', md:'row' }} spacing={4} mb={4}>
          <Input
            placeholder="Search by name, ID or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            maxW="300px"
            InputLeftElement={
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 ml-2"/>
            }
          />
          <Select
            placeholder="Filter by Program"
            value={programFilter}
            onChange={e => setProgramFilter(e.target.value)}
            maxW="200px"
          >
            {programs.map(p => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Stack>

        <Table variant="striped">
          <Thead bg={gradientBg}>
            <Tr>
              <Th color="white">ID</Th>
              <Th color="white">Student</Th>
              <Th color="white">Program</Th>
              <Th color="white">Concerns</Th>
              <Th color="white">Signature</Th>
              <Th color="white">Submitted At</Th>
              <Th color="white">Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map(d => (
              <Tr key={d.id}>
                <Td>{d.submissionId}</Td>
                <Td>
                  <VStack align="start">
                    <Text fontWeight="bold">{d.fullName}</Text>
                    <Text fontSize="sm">{d.studentId}</Text>
                  </VStack>
                </Td>
                <Td>{d.program}</Td>
                <Td>
                  {d.psychologicalConcerns_yes && 'Psych Concerns, '}
                  {d.consultedPsychotherapist_yes && 'Consulted, '}
                  {d.currentTreatment_yes && 'Treatment, '}
                  {d.wantsCounsellingServices_yes && 'Wants Counselling, '}
                  {d.learningChallenges_yes && 'Learning Challenges'}
                </Td>
                <Td>
                  <Image
                    boxSize="60px"
                    objectFit="cover"
                    src={d.signature}
                    alt="signature"
                    fallbackSrc="https://via.placeholder.com/60"
                  />
                </Td>
                <Td>{new Date(d.submittedAt).toLocaleString()}</Td>
                <Td>
                  <HStack spacing={1}>
                    <IconButton
                      icon={<EyeIcon className="h-5 w-5"/>}
                      size="sm"
                      onClick={() => openView(d)}
                      aria-label="View"
                    />
                    <IconButton
                      icon={<PencilSquareIcon className="h-5 w-5"/>}
                      size="sm"
                      onClick={() => openEdit(d)}
                      aria-label="Edit"
                    />
                    <IconButton
                      icon={<TrashIcon className="h-5 w-5"/>}
                      size="sm"
                      colorScheme="red"
                      onClick={() => handleDelete(d.id)}
                      aria-label="Delete"
                    />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>

      {/* View Modal */}
      <Modal isOpen={!!viewItem} onClose={closeView} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Full Declaration Report</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {viewItem && (
              <Table variant="simple" size="sm" mb={4}>
                <Thead bg={gradientBg}>
                  <Tr>
                    <Th color="white">Field</Th>
                    <Th color="white">Value</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {Object.entries(viewItem).map(([key, val]) => (
                    <Tr key={key}>
                      <Td fontWeight="bold">{key}</Td>
                      <Td>
                        {key === 'supportingDocuments' && val
                          ? val.split(',').map(fn => (
                              <Box key={fn}>
                                <a
                                  href={`${ATTACH_BASE}/${fn}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  {fn}
                                </a>
                              </Box>
                            ))
                          : String(val)
                        }
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={closeView}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={!!editItem} onClose={closeEdit} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Declaration</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {editItem && (
              <VStack spacing={4}>
                <FormControl>
                  <FormLabel>Full Name</FormLabel>
                  <Input
                    value={form.fullName}
                    onChange={e => setForm({ ...form, fullName: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Program</FormLabel>
                  <Input
                    value={form.program}
                    onChange={e => setForm({ ...form, program: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <Checkbox
                    isChecked={form.psychologicalConcerns_yes}
                    onChange={e => setForm({
                      ...form,
                      psychologicalConcerns_yes: e.target.checked,
                      psychologicalConcerns_no: !e.target.checked
                    })}
                  >
                    Psychological Concerns
                  </Checkbox>
                </FormControl>
                <FormControl>
                  <FormLabel>Parent Name</FormLabel>
                  <Input
                    value={form.parentName}
                    onChange={e => setForm({ ...form, parentName: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Parent Contact</FormLabel>
                  <Input
                    value={form.parentContact}
                    onChange={e => setForm({ ...form, parentContact: e.target.value })}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Parent Email</FormLabel>
                  <Input
                    value={form.parentEmail}
                    onChange={e => setForm({ ...form, parentEmail: e.target.value })}
                  />
                </FormControl>
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <Button onClick={closeEdit} mr={3}>Cancel</Button>
            <Button colorScheme="blue" onClick={handleUpdate}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
