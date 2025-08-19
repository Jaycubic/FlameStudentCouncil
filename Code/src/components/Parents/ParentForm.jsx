import { useState } from 'react';
import { VStack, FormControl, FormLabel, Input, Button, useToast } from '@chakra-ui/react';

function ParentForm({ parent, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    FatherName: parent?.FatherName || '',
    FatherEmailID: parent?.FatherEmailID || '',
    FatherMobileNo: parent?.FatherMobileNo || '',
    MotherName: parent?.MotherName || '',
    MotherEmailID: parent?.MotherEmailID || '',
    MotherMobileNo: parent?.MotherMobileNo || '',
  });

  const toast = useToast();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (Object.values(formData).some(value => !value.trim())) {
      toast({ title: 'All fields are required', status: 'error', duration: 3000 });
      return;
    }
    onSubmit(formData);
  };

  return (
    <VStack spacing={4}>
      <FormControl>
        <FormLabel>Father Name</FormLabel>
        <Input name="FatherName" value={formData.FatherName} onChange={handleChange} />
      </FormControl>
      <FormControl>
        <FormLabel>Father Email</FormLabel>
        <Input name="FatherEmailID" value={formData.FatherEmailID} onChange={handleChange} />
      </FormControl>
      <FormControl>
        <FormLabel>Father Mobile</FormLabel>
        <Input name="FatherMobileNo" value={formData.FatherMobileNo} onChange={handleChange} />
      </FormControl>
      <FormControl>
        <FormLabel>Mother Name</FormLabel>
        <Input name="MotherName" value={formData.MotherName} onChange={handleChange} />
      </FormControl>
      <FormControl>
        <FormLabel>Mother Email</FormLabel>
        <Input name="MotherEmailID" value={formData.MotherEmailID} onChange={handleChange} />
      </FormControl>
      <FormControl>
        <FormLabel>Mother Mobile</FormLabel>
        <Input name="MotherMobileNo" value={formData.MotherMobileNo} onChange={handleChange} />
      </FormControl>
      <HStack spacing={3} justify="flex-end" w="full">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button colorScheme="blue" onClick={handleSubmit}>Save</Button>
      </HStack>
    </VStack>
  );
}

export default ParentForm;