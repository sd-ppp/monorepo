import type { Task } from '../../../base/Task';
import type { SDPPPSponsor } from '../../client';
import { sponsorExecutionStore } from './executionStore';

export const createSponsorTask = async <T>(
  client: SDPPPSponsor,
  templateId: string,
  payload: Record<string, any>
): Promise<Task<T>> => {
  const task = await client.run(templateId, payload);
  sponsorExecutionStore.setState({
    runningTasks: [...sponsorExecutionStore.getState().runningTasks, task],
  });
  task.promise.finally(() => {
    sponsorExecutionStore.setState({
      runningTasks: sponsorExecutionStore.getState().runningTasks.filter((t) => t !== task),
    });
  });
  return task as Task<T>;
};
