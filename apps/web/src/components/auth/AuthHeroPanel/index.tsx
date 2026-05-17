import {
  AuthHeroDescription,
  AuthHeroEyebrow,
  AuthHeroFeatureItem,
  AuthHeroFeatureList,
  AuthHeroPanelContent,
  AuthHeroPanelRoot,
  AuthHeroTitle,
} from './AuthHeroPanel.style';

interface AuthHeroPanelProps {
  description: string;
  eyebrow: string;
  features: string[];
  title: string;
}

export function AuthHeroPanel({ description, eyebrow, features, title }: AuthHeroPanelProps) {
  return (
    <AuthHeroPanelRoot>
      <AuthHeroPanelContent>
        <AuthHeroEyebrow>{eyebrow}</AuthHeroEyebrow>
        <AuthHeroTitle>{title}</AuthHeroTitle>
        <AuthHeroDescription>{description}</AuthHeroDescription>
        <AuthHeroFeatureList>
          {features.map((feature) => (
            <AuthHeroFeatureItem key={feature}>{feature}</AuthHeroFeatureItem>
          ))}
        </AuthHeroFeatureList>
      </AuthHeroPanelContent>
    </AuthHeroPanelRoot>
  );
}
