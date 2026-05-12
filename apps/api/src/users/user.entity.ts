import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
@Index('IDX_users_email_unique', ['email'], { unique: true })
export class User {
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ length: 120, name: 'display_name', type: 'varchar' })
  displayName!: string;

  @Column({ length: 320, type: 'varchar' })
  email!: string;

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255, name: 'password_hash', select: false, type: 'varchar' })
  passwordHash!: string;

  @Column({ array: true, default: () => "'{}'", type: 'text' })
  roles!: string[];

  @Column({ array: true, default: () => "'{}'", type: 'text' })
  scopes!: string[];

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
