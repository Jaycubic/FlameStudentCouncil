// src/pages/PositionsView.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Card, CardBody, Flex, Text, VStack, HStack, Input, InputGroup,
  InputLeftElement, InputRightElement, Button, IconButton, Spinner,
  Badge, Table, Thead, Tbody, Tr, Th, Td, Modal, ModalOverlay,
  ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  useColorModeValue, useToast, useDisclosure, FormControl, FormLabel,
  Textarea, AlertDialog, AlertDialogBody, AlertDialogHeader,
  AlertDialogContent, AlertDialogOverlay, AlertDialogFooter
} from '@chakra-ui/react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  PencilSquareIcon,
  TrashIcon,
  PlusIcon,
  QueueListIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import PageHeader from '../components/layout/PageHeader';
import { positionService } from '../services/positionService';

function PositionsView() {
  const toast = useToast();

  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit / Create Modal state
  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();
  const [editingPosition, setEditingPosition] = useState(null); // null = create mode
  const [description, setDescription] = useState('');

  // Delete Alert state
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();
  const [deletingPosition, setDeletingPosition] = useState(null);
  const cancelRef = React.useRef();

  // Color modes matching app theme
  const cardBg = useColorModeValue('white', 'gray.800');
  const borderColor = useColorModeValue('gray.200', '#304945');
  const textColor = useColorModeValue('gray.600', 'gray.300');
  const tableHeaderBg = useColorModeValue('gray.50', 'gray.900');
  const hoverRowBg = useColorModeValue('blue.50/50', 'whiteAlpha.50');
  const headerGradient = useColorModeValue(
    'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
    'linear-gradient(135deg, #581c87 0%, #ec4899 100%)'
  );

  // Fetch Positions
  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await positionService.getAllPositions();
      if (response.success) {
        setPositions(response.data || []);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch candidate positions',
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  // Handle Open Create Modal
  const handleCreateOpen = () => {
    setEditingPosition(null);
    setDescription('');
    onFormOpen();
  };

  // Handle Open Edit Modal
  const handleEditOpen = (pos) => {
    setEditingPosition(pos);
    setDescription(pos.description);
    onFormOpen();
  };

  // Handle Save (Create or Edit)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Position description cannot be empty',
        status: 'warning',
        duration: 2500,
      });
      return;
    }

    setSaving(true);
    try {
      if (editingPosition) {
        // Edit Mode
        const res = await positionService.updatePosition(editingPosition.id, { description });
        if (res.success) {
          toast({
            title: 'Updated Successfully',
            description: 'Position description has been updated.',
            status: 'success',
            duration: 3000,
          });
        }
      } else {
        // Create Mode
        const res = await positionService.createPosition({ description });
        if (res.success) {
          toast({
            title: 'Created Successfully',
            description: 'New candidate position added.',
            status: 'success',
            duration: 3000,
          });
        }
      }
      onFormClose();
      fetchPositions();
    } catch (error) {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save position',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle Open Delete Dialog
  const handleDeleteOpen = (pos) => {
    setDeletingPosition(pos);
    onDeleteOpen();
  };

  // Handle Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingPosition) return;
    setDeleting(true);
    try {
      const res = await positionService.deletePosition(deletingPosition.id);
      if (res.success) {
        toast({
          title: 'Deleted',
          description: 'Candidate position removed successfully.',
          status: 'success',
          duration: 3000,
        });
        onDeleteClose();
        fetchPositions();
      }
    } catch (error) {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete position',
        status: 'error',
        duration: 4000,
      });
    } finally {
      setDeleting(false);
    }
  };

  // Filtered positions based on search
  const filteredPositions = positions.filter((pos) =>
    pos.description.toLowerCase().includes(search.toLowerCase()) ||
    String(pos.id).includes(search)
  );

  return (
    <Box p={{ base: 4, md: 8 }}>
      {/* Top Page Header */}
      <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'stretch', md: 'center' }} mb={6} gap={4}>
        <PageHeader
          title="Candidate Positions Management"
          description="Configure and manage election candidate positions for FLAME Student Council"
        />
        <Button
          leftIcon={<PlusIcon style={{ width: 18, height: 18 }} />}
          bgGradient={headerGradient}
          color="white"
          size="lg"
          borderRadius="xl"
          boxShadow="md"
          _hover={{ opacity: 0.9, transform: 'translateY(-2px)' }}
          _active={{ transform: 'translateY(0)' }}
          onClick={handleCreateOpen}
        >
          Add New Position
        </Button>
      </Flex>

      {/* Filter and Count Bar */}
      <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="2xl" shadow="md" mb={6}>
        <CardBody p={5}>
          <Flex direction={{ base: 'column', sm: 'row' }} justify="space-between" align="center" gap={4}>
            <InputGroup maxW={{ base: '100%', sm: '380px' }}>
              <InputLeftElement pointerEvents="none">
                <MagnifyingGlassIcon style={{ width: 18, height: 18, color: '#94a3b8' }} />
              </InputLeftElement>
              <Input
                placeholder="Search positions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                borderRadius="xl"
                size="md"
                focusBorderColor="blue.400"
              />
              {search && (
                <InputRightElement>
                  <IconButton
                    icon={<XMarkIcon style={{ width: 16, height: 16 }} />}
                    size="xs"
                    variant="ghost"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                  />
                </InputRightElement>
              )}
            </InputGroup>

            <HStack spacing={3}>
              <Badge colorScheme="blue" fontSize="sm" px={3} py={1} borderRadius="full">
                Total Positions: {positions.length}
              </Badge>
              {search && (
                <Badge colorScheme="purple" fontSize="sm" px={3} py={1} borderRadius="full">
                  Matching: {filteredPositions.length}
                </Badge>
              )}
            </HStack>
          </Flex>
        </CardBody>
      </Card>

      {/* Main Table Card */}
      <Card bg={cardBg} border="1px solid" borderColor={borderColor} borderRadius="2xl" shadow="xl" overflow="hidden">
        <CardBody p={0}>
          {loading ? (
            <Flex justify="center" align="center" py={16}>
              <Spinner size="xl" thickness="4px" color="blue.500" />
            </Flex>
          ) : filteredPositions.length === 0 ? (
            <VStack py={16} spacing={4}>
              <QueueListIcon style={{ width: 48, height: 48, color: '#94a3b8' }} />
              <Text fontSize="lg" fontWeight="semibold" color={textColor}>
                {search ? 'No candidate positions match your search' : 'No candidate positions configured yet'}
              </Text>
              {!search && (
                <Button colorScheme="blue" variant="outline" borderRadius="xl" onClick={handleCreateOpen}>
                  Create First Position
                </Button>
              )}
            </VStack>
          ) : (
            <Box overflowX="auto">
              <Table variant="simple">
                <Thead bg={tableHeaderBg}>
                  <Tr>
                    <Th w="80px" py={4}># ID</Th>
                    <Th py={4}>Position Description</Th>
                    <Th w="180px" py={4}>Created Date</Th>
                    <Th w="120px" py={4} textAlign="center">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {filteredPositions.map((pos) => (
                    <Tr key={pos.id} _hover={{ bg: hoverRowBg }} transition="background 0.2s">
                      <Td fontWeight="bold" color="blue.500">
                        #{pos.id}
                      </Td>
                      <Td fontWeight="medium" fontSize="md">
                        {pos.description}
                      </Td>
                      <Td fontSize="sm" color={textColor}>
                        <HStack spacing={1}>
                          <ClockIcon style={{ width: 14, height: 14 }} />
                          <Text>
                            {pos.createdAt
                              ? new Date(pos.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : 'N/A'}
                          </Text>
                        </HStack>
                      </Td>
                      <Td textAlign="center">
                        <HStack spacing={2} justify="center">
                          <IconButton
                            icon={<PencilSquareIcon style={{ width: 16, height: 16 }} />}
                            aria-label="Edit position"
                            size="sm"
                            colorScheme="blue"
                            variant="ghost"
                            borderRadius="lg"
                            onClick={() => handleEditOpen(pos)}
                          />
                          <IconButton
                            icon={<TrashIcon style={{ width: 16, height: 16 }} />}
                            aria-label="Delete position"
                            size="sm"
                            colorScheme="red"
                            variant="ghost"
                            borderRadius="lg"
                            onClick={() => handleDeleteOpen(pos)}
                          />
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </CardBody>
      </Card>

      {/* Add / Edit Modal */}
      <Modal isOpen={isFormOpen} onClose={onFormClose} isCentered size="lg">
        <ModalOverlay backdropFilter="blur(4px)" />
        <ModalContent borderRadius="2xl">
          <form onSubmit={handleFormSubmit}>
            <ModalHeader fontWeight="bold" fontSize="xl">
              {editingPosition ? `Edit Position #${editingPosition.id}` : 'Add New Candidate Position'}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody py={4}>
              <VStack spacing={4}>
                <FormControl isRequired>
                  <FormLabel fontWeight="semibold">Position Description</FormLabel>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. House Captain Chanakya (PG2, UG4, UG3 Batch) - House Colour Green"
                    rows={3}
                    borderRadius="xl"
                    focusBorderColor="blue.400"
                  />
                </FormControl>
              </VStack>
            </ModalBody>

            <ModalFooter gap={3}>
              <Button variant="ghost" borderRadius="xl" onClick={onFormClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                bgGradient={headerGradient}
                color="white"
                borderRadius="xl"
                isLoading={saving}
                loadingText="Saving..."
              >
                {editingPosition ? 'Update Position' : 'Create Position'}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Alert */}
      <AlertDialog isOpen={isDeleteOpen} leastDestructiveRef={cancelRef} onClose={onDeleteClose} isCentered>
        <AlertDialogOverlay backdropFilter="blur(4px)">
          <AlertDialogContent borderRadius="2xl">
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Candidate Position
            </AlertDialogHeader>
            <AlertDialogBody>
              Are you sure you want to delete position{' '}
              <strong>"{deletingPosition?.description}"</strong>?
              This action cannot be undone.
            </AlertDialogBody>
            <AlertDialogFooter gap={3}>
              <Button ref={cancelRef} onClick={onDeleteClose} borderRadius="xl">
                Cancel
              </Button>
              <Button colorScheme="red" onClick={handleConfirmDelete} isLoading={deleting} borderRadius="xl">
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </Box>
  );
}

export default PositionsView;
