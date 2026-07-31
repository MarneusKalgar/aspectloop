import { UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import { Roles, Scopes } from '../auth/decorators';
import { GqlJwtAuthGuard } from '../auth/guards/gql-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ScopesGuard } from '../auth/guards/scopes.guard';
import { DocumentRegistryService } from './document-registry.service';

@Resolver()
export class DocumentTypesResolver {
  constructor(private readonly documentRegistryService: DocumentRegistryService) {}

  @Query('correctionDocumentTypes')
  @Roles('CORRECTOR')
  @Scopes('corrections:write')
  @UseGuards(GqlJwtAuthGuard, RolesGuard, ScopesGuard)
  correctionDocumentTypes() {
    return this.documentRegistryService.listDocumentTypes();
  }
}
