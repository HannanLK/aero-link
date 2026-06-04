locals {
  broker_count = length(var.private_subnet_ids)
}

resource "aws_security_group" "msk" {
  name        = "${var.prefix}-msk-sg"
  description = "MSK Kafka - allow TLS from EKS nodes"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Kafka TLS from EKS"
    from_port       = 9098
    to_port         = 9098
    protocol        = "tcp"
    security_groups = [var.eks_sg_id]
  }

  ingress {
    description     = "ZooKeeper from EKS (internal)"
    from_port       = 2181
    to_port         = 2181
    protocol        = "tcp"
    security_groups = [var.eks_sg_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_msk_configuration" "main" {
  name           = "${var.prefix}-kafka-config"
  kafka_versions = [var.kafka_version]

  server_properties = <<-EOF
    auto.create.topics.enable=false
    default.replication.factor=${min(local.broker_count, 3)}
    min.insync.replicas=${local.broker_count > 1 ? 2 : 1}
    num.io.threads=8
    num.network.threads=5
    num.partitions=3
    num.replica.fetchers=2
    replica.lag.time.max.ms=30000
    socket.receive.buffer.bytes=102400
    socket.request.max.bytes=104857600
    socket.send.buffer.bytes=102400
    unclean.leader.election.enable=false
    log.retention.hours=168
    log.segment.bytes=1073741824
    offsets.topic.replication.factor=${min(local.broker_count, 3)}
  EOF
}

resource "aws_msk_cluster" "main" {
  cluster_name           = "${var.prefix}-kafka"
  kafka_version          = var.kafka_version
  number_of_broker_nodes = local.broker_count

  broker_node_group_info {
    instance_type   = var.broker_instance_type
    client_subnets  = var.private_subnet_ids
    security_groups = [aws_security_group.msk.id]
    storage_info {
      ebs_storage_info {
        volume_size = 100
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = var.cmk_pii_arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  client_authentication {
    sasl {
      iam = true
    }
  }

  configuration_info {
    arn      = aws_msk_configuration.main.arn
    revision = aws_msk_configuration.main.latest_revision
  }

  open_monitoring {
    prometheus {
      jmx_exporter  { enabled_in_broker = true }
      node_exporter { enabled_in_broker = true }
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
    }
  }
}

resource "aws_cloudwatch_log_group" "msk" {
  name              = "/aws/msk/${var.prefix}"
  retention_in_days = 14
  kms_key_id        = var.cmk_pii_arn
}
