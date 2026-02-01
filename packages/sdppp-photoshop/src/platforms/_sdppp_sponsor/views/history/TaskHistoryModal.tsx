import type { ReactNode } from 'react';
import { memo } from 'react';
import { Modal } from 'antd';

export type TaskHistoryModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

const TaskHistoryModal = memo(function TaskHistoryModal({
  open,
  title,
  onClose,
  children,
}: TaskHistoryModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      footer={null}
      destroyOnClose
      width={720}
    >
      {children}
    </Modal>
  );
});

export default TaskHistoryModal;
