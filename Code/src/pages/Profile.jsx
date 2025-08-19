import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardBody,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Text,
  VStack,
  Heading,
  List,
  ListItem,
  useColorModeValue,
} from '@chakra-ui/react';
import { legalDocumentService } from '../services/LegalDocumentService';
import PageHeader from '../components/layout/PageHeader';

function Settings() {
  const [privacyPolicy, setPrivacyPolicy] = useState('');
  const [termsOfService, setTermsOfService] = useState('');
  const [documentation] = useState(
    'This is sample documentation content for demonstration purposes. ' +
    'It includes instructions and guidelines for using the application.'
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const privacy = await legalDocumentService.getDocumentByType('Privacy Policy');
        const terms = await legalDocumentService.getDocumentByType('Terms of Service');
        setPrivacyPolicy(privacy || 'Privacy Policy not found.');
        setTermsOfService(terms || 'Terms of Service not found.');
      } catch (error) {
        console.error('Error fetching legal documents:', error);
      }
    };
    fetchData();
  }, []);

  const parseContent = (content) => {
    if (!content) return null;

    const sectionRegex = /(\d+\.\s+[^:]+:)/;
    const parts = content.split(sectionRegex);
    const parsedContent = [];

    if (parts[0].trim()) {
      parsedContent.push(
        <Text key="intro" mb={4} lineHeight="1.6">
          {parts[0].trim()}
        </Text>
      );
    }

    for (let i = 1; i < parts.length; i += 2) {
      const heading = parts[i];
      const text = parts[i + 1] || '';

      parsedContent.push(
        <Box key={heading} mb={6}>
          <Heading as="h3" size="md" color="blue.600" mb={2}>
            {heading}
          </Heading>
          {text.trim() && (
            <List styleType="disc" pl={5}>
              {text
                .split('- ')
                .filter(item => item.trim())
                .map((item, index) => (
                  <ListItem key={index}>
                    <Text lineHeight="1.6">{item.trim()}</Text>
                  </ListItem>
                ))}
            </List>
          )}
        </Box>
      );
    }

    return parsedContent;
  };

  // Gradient palettes matching Sidebar.jsx
  const bgGradient = useColorModeValue(
    'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', // Light mode
    'linear(to-b, purple.700, pink.500)' // Dark mode
  );
  const activeTabBg = useColorModeValue(
    'linear(to-r, blue.500, blue.400)', // Light mode
    'linear(to-r, purple.600, pink.400)' // Dark mode
  );
  const hoverTabBg = useColorModeValue(
    'linear(to-r, blue.300, blue.200)', // Light mode
    'linear(to-r, purple.500, pink.300)' // Dark mode
  );
  const tabTextColor = useColorModeValue('white', 'gray.200');
  const inactiveTabTextColor = useColorModeValue('gray.100', 'gray.400');

  return (
    <Box p={8}>
      <PageHeader
        title="Documentation & License"
        description="View legal documents and documentation"
      />
      <Card>
        <CardBody>
          <Tabs variant="soft-rounded" colorScheme="vrv">
            <TabList mb={6} gap={2}>
              {['Privacy Policy', 'Terms of Service', 'Documentation'].map((tab, index) => (
                <Tab
                  key={index}
                  bgGradient={bgGradient}
                  color={inactiveTabTextColor}
                  _selected={{ bgGradient: activeTabBg, color: tabTextColor }}
                  _hover={{ bgGradient: hoverTabBg }}
                  borderRadius="md"
                  px={4}
                  py={2}
                >
                  {tab}
                </Tab>
              ))}
            </TabList>
            <TabPanels>
              <TabPanel>
                <VStack align="start">
                  {parseContent(privacyPolicy)}
                </VStack>
              </TabPanel>
              <TabPanel>
                <VStack align="start">
                  {parseContent(termsOfService)}
                </VStack>
              </TabPanel>
              <TabPanel>
                <VStack align="start">
                  {parseContent(documentation)}
                </VStack>
              </TabPanel>
            </TabPanels>
          </Tabs>
        </CardBody>
      </Card>
    </Box>
  );
}

export default Settings;
