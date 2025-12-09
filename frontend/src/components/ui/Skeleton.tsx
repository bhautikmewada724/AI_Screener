import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

const Skeleton = ({ className }: SkeletonProps) => {
  return <div className={clsx('skeleton', className)} />;
};

export default Skeleton;

