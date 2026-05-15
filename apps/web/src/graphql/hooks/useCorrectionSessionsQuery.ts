import { useQuery } from '@apollo/client/react';

import type { CorrectionSessionsQuery, CorrectionSessionsQueryVariables } from '../../gql/graphql';
import type { GraphqlOperationState } from './types';

import { graphql } from '../../gql';
import { getOperationErrorMessage } from '../utils/getOperationErrorMessage';

const correctionSessionsQueryDocument = graphql(`
  query CorrectionSessions {
    correctionSessions {
      id
      documentId
      documentType
      status
      version
      updatedAt
    }
  }
`);

export function useCorrectionSessionsQuery(): GraphqlOperationState<
  CorrectionSessionsQuery['correctionSessions']
> {
  const { data, error, loading } = useQuery<
    CorrectionSessionsQuery,
    CorrectionSessionsQueryVariables
  >(correctionSessionsQueryDocument);

  return {
    data:
      data?.correctionSessions.map((session) => ({
        documentId: session.documentId,
        documentType: session.documentType,
        id: session.id,
        status: session.status,
        updatedAt: session.updatedAt,
        version: session.version,
      })) ?? null,
    error: getOperationErrorMessage(error),
    loading,
  };
}
