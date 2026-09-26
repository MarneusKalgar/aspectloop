import { PLATFORM_AUTH_ROLE, PLATFORM_AUTH_SCOPE } from '@aspectloop/contracts/platform';
import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { RequestId, Roles, Scopes } from '../auth/decorators';
import { GqlJwtAuthGuard } from '../auth/guards/gql-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { DocumentRegistryService } from './document-registry.service';

@Resolver()
export class DocumentTypesResolver {
  constructor(private readonly documentRegistryService: DocumentRegistryService) {}

  @Query('correctionDocumentTypes')
  @Roles(PLATFORM_AUTH_ROLE.CORRECTOR)
  @Scopes(PLATFORM_AUTH_SCOPE.CORRECTIONS_WRITE)
  @UseGuards(GqlJwtAuthGuard, RolesGuard, ScopesGuard)
  correctionDocumentTypes(@RequestId() requestId?: string) {
    return this.documentRegistryService.listDocumentTypes({ requestId });
  }
}
