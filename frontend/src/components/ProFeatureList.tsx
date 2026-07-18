import { SimpleGrid, type SimpleGridProps } from '@mantine/core';
import { PRO_FEATURES } from '../lib/proPlan';
import FeatureRow from './FeatureRow';

type ProFeatureListProps = {
  columns?: SimpleGridProps['cols'];
};

const ProFeatureList = ({ columns = 1 }: ProFeatureListProps) => (
  <SimpleGrid cols={columns} spacing="md" verticalSpacing="xs">
    {PRO_FEATURES.map((feature) => (
      <FeatureRow key={feature.title} feature={feature} compact />
    ))}
  </SimpleGrid>
);

export default ProFeatureList;
