// src/pages/WellbeingDeclarations.jsx
import { useEffect, useState } from 'react';
import {
  Box, Table, Thead, Tbody, Tr, Th, Td,
  IconButton, VStack, useToast, Spinner,
  Flex, Text, Card, Button, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalCloseButton,
  ModalBody, ModalFooter, FormControl, FormLabel,
  Input, Checkbox, Image, useColorModeValue
} from '@chakra-ui/react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import wellbeingService from '../services/wellbeingService';

export default function WellbeingDeclarations() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const toast = useToast();
  const bgColor = useColorModeValue('white','gray.800');
  const gradientBg = 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)';

  const fetchAll = async () => {
    setLoading(true);
    try {
      const all = await wellbeingService.getAll();
      setData(all);
    } catch (e) {
      toast({ title:'Error', description:e.message, status:'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ ...item });
  };

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

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this record?')) return;
    try {
      await wellbeingService.delete(id);
      toast({ title:'Deleted', status:'success' });
      fetchAll();
    } catch (e) {
      toast({ title:'Error', description:e.message, status:'error' });
    }
  };

  if (loading) return (
    <Flex justify="center" py={20}><Spinner size="xl" /></Flex>
  );

  return (
    <Box p={8}>
      <Card bg={bgColor} p={4} overflowX="auto">
        <Text fontSize="2xl" mb={4}>Wellbeing Declarations</Text>
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
            {data.map(d => (
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
                  {d.psychologicalConcerns_yes ? 'Psych Concerns, ' : ''}
                  {d.learningChallenges_yes ? 'Learning Challenges' : ''}
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
                  <IconButton
                    icon={<PencilSquareIcon className="h-5 w-5" />}
                    size="sm"
                    mr={2}
                    onClick={() => openEdit(d)}
                  />
                  <IconButton
                    icon={<TrashIcon className="h-5 w-5" />}
                    size="sm"
                    colorScheme="red"
                    onClick={() => handleDelete(d.id)}
                  />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Card>

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
