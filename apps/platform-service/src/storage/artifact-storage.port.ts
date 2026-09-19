import type {
  ArtifactObject,
  ArtifactObjectLocation,
  ArtifactObjectMetadata,
  ArtifactOperationContext,
  VerifyArtifactObjectInput,
  WriteArtifactObjectInput,
} from './artifact-storage.types';

export const ARTIFACT_STORAGE = Symbol('ARTIFACT_STORAGE');

export interface ArtifactStorage {
  getObject(
    location: ArtifactObjectLocation,
    context?: ArtifactOperationContext,
  ): Promise<ArtifactObject>;
  headObject(
    location: ArtifactObjectLocation,
    context?: ArtifactOperationContext,
  ): Promise<ArtifactObjectMetadata>;
  verifyObject(input: VerifyArtifactObjectInput): Promise<ArtifactObjectMetadata>;
  writeObject(input: WriteArtifactObjectInput): Promise<ArtifactObjectMetadata>;
}
