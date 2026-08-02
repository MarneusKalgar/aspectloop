import { useQuery } from '@apollo/client/react';

import type { CorrectionSessionsQuery } from '../../../generated/graphql';
import type { GraphqlOperationState } from '../../types';

import { graphql } from '../../../generated';
import { getOperationErrorMessage } from '../../../utils/getOperationErrorMessage';

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

/**
 * Loads correction sessions for the authenticated user's inbox.
 *
 * @returns The current correction-session data, error, and loading state.
 */
export function useCorrectionSessionsQuery(): GraphqlOperationState<
  CorrectionSessionsQuery['correctionSessions']
> {
  const { data, error, loading } = useQuery(correctionSessionsQueryDocument);

  return {
    data:
      data?.correctionSessions.map(
        /**
         * Maps generated GraphQL data into the inbox row shape.
         *
         * @param session One correction session returned by the query.
         * @returns The inbox row fields selected by the operation.
         */
        (session) => ({
          documentId: session.documentId,
          documentType: session.documentType,
          id: session.id,
          status: session.status,
          updatedAt: session.updatedAt,
          version: session.version,
        }),
      ) ?? null,
    error: getOperationErrorMessage(error),
    loading,
  };
}
