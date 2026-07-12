FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY DeltaResume.Api.fsproj .
RUN dotnet restore

COPY . .
RUN dotnet publish DeltaResume.Api.fsproj -c Release -o /app/out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/out .

EXPOSE 8080
ENTRYPOINT ["dotnet", "DeltaResume.Api.dll"]
