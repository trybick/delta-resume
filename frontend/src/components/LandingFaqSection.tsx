import { Accordion, Stack, Text, Title } from '@mantine/core';
import { AnalyticsEvents, trackEvent } from '../lib/analytics';

type FaqItem = {
  question: string;
  answer: string;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'Why not just paste my resume into ChatGPT?',
    answer:
      'A chat window hands back a rewritten wall of text and leaves you to spot what changed. Delta Resume shows every edit as an inline diff you accept or revert one by one, keeps your document formatting for export, and can automatically fit your resume to one page by scaling the sizing. Every tailor run also writes a matching cover letter. On Pro it flags job requirements your resume doesn\u2019t cover yet.',
  },
  {
    question: 'Will the rewrites sound like me?',
    answer:
      'You have the final say on every word. Each rewrite is shown as an inline diff. Keep it or revert it with one click. Nothing changes unless you approve it, so your resume stays in your voice.',
  },
  {
    question: 'Is my resume stored or used to train AI?',
    answer:
      'Guest runs are processed in memory and discarded as soon as your suggestions are ready. They are never stored and never used to train AI models. With an account, your resume is saved so you can reuse it, and you can rename or delete it anytime.',
  },
  {
    question: 'What can I upload, and what can I export?',
    answer:
      'Upload a .docx or .pdf, or paste plain text. Export your tailored resume as a DOCX or PDF, keeping your original formatting or using a clean template, with an option to fit it to one page, or copy it to your clipboard.',
  },
  {
    question: 'Do I need an account to try it?',
    answer:
      'No. You get free credits the moment you open the app. Paste your resume and a job post and you\u2019ll see suggested rewrites in seconds. No sign-up, no card.',
  },
  {
    question: 'Does the free plan include cover letters?',
    answer:
      'Yes. Every tailor run writes a matching cover letter from the same resume and job post. Pro lets you choose the length and tone.',
  },
];

const LandingFaqSection = () => {
  const handleAccordionChange = (value: string | null) => {
    if (!value) return;
    trackEvent(AnalyticsEvents.LandingFaqToggle, { question: value });
  };

  return (
    <Stack gap="xl" align="center">
      <Stack gap={4} align="center">
        <Title order={2} ta="center">
          Frequently asked questions
        </Title>
        <Text size="sm" c="dimmed" ta="center" maw={520}>
          The short answers to the things people check before pasting their resume.
        </Text>
      </Stack>
      <Accordion
        variant="separated"
        radius="md"
        w="100%"
        maw={720}
        onChange={handleAccordionChange}
      >
        {FAQ_ITEMS.map((item) => (
          <Accordion.Item key={item.question} value={item.question}>
            <Accordion.Control>
              <Text size="sm" fw={600}>
                {item.question}
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Text size="sm" c="dimmed" lh={1.6}>
                {item.answer}
              </Text>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
};

export default LandingFaqSection;
