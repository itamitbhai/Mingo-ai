import {
  AuthOption,
  BackendStack,
  DatabaseOption,
  DeploymentOption,
  FrontendStack,
  StylingOption,
} from 'shared';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  stack: {
    frontend: FrontendStack;
    backend: BackendStack;
    database: DatabaseOption;
    authentication: AuthOption;
    styling: StylingOption;
    deployment: DeploymentOption;
  };
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'nextjs-saas',
    name: 'Next.js SaaS Starter',
    description: 'A full-stack SaaS foundation with Next.js, Express, and MongoDB.',
    stack: {
      frontend: FrontendStack.NEXTJS,
      backend: BackendStack.EXPRESS,
      database: DatabaseOption.MONGODB,
      authentication: AuthOption.CLERK,
      styling: StylingOption.SHADCN,
      deployment: DeploymentOption.VERCEL,
    },
  },
  {
    id: 'react-api',
    name: 'React + REST API',
    description: 'A React single-page app backed by a Node and Express REST API.',
    stack: {
      frontend: FrontendStack.REACT,
      backend: BackendStack.NODE,
      database: DatabaseOption.MONGODB,
      authentication: AuthOption.JWT,
      styling: StylingOption.TAILWIND,
      deployment: DeploymentOption.RAILWAY,
    },
  },
  {
    id: 'nestjs-enterprise',
    name: 'Enterprise NestJS Backend',
    description: 'A structured NestJS API with MongoDB, built for larger teams.',
    stack: {
      frontend: FrontendStack.NEXTJS,
      backend: BackendStack.NESTJS,
      database: DatabaseOption.MONGODB,
      authentication: AuthOption.JWT,
      styling: StylingOption.SHADCN,
      deployment: DeploymentOption.RENDER,
    },
  },
  {
    id: 'vue-express',
    name: 'Vue + Express',
    description: 'A lightweight Vue frontend paired with an Express API.',
    stack: {
      frontend: FrontendStack.VUE,
      backend: BackendStack.EXPRESS,
      database: DatabaseOption.MONGODB,
      authentication: AuthOption.FIREBASE,
      styling: StylingOption.TAILWIND,
      deployment: DeploymentOption.VERCEL,
    },
  },
  {
    id: 'firebase-quickstart',
    name: 'Firebase Auth Quickstart',
    description: 'Next.js with Firebase authentication for rapid prototyping.',
    stack: {
      frontend: FrontendStack.NEXTJS,
      backend: BackendStack.NODE,
      database: DatabaseOption.MONGODB,
      authentication: AuthOption.FIREBASE,
      styling: StylingOption.TAILWIND,
      deployment: DeploymentOption.RENDER,
    },
  },
  {
    id: 'clerk-production',
    name: 'Production Clerk Stack',
    description: 'The exact stack Mingo AI itself runs on: Next.js, Express, Clerk, and MongoDB.',
    stack: {
      frontend: FrontendStack.NEXTJS,
      backend: BackendStack.EXPRESS,
      database: DatabaseOption.MONGODB,
      authentication: AuthOption.CLERK,
      styling: StylingOption.SHADCN,
      deployment: DeploymentOption.RAILWAY,
    },
  },
];
