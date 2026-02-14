FROM eclipse-temurin:25-jdk

WORKDIR /workspace

RUN useradd -m -s /bin/bash runner && \
    chown -R runner:runner /workspace

USER runner

CMD ["sh"]
