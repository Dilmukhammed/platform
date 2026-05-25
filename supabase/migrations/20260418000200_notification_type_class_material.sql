-- T2: Add notification type enum for class materials
-- Creates notification_type_enum with class_material_added value

create type public.notification_type_enum as enum (
  'class_material_added'
);
